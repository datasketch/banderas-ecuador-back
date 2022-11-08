#!/usr/bin/env node
'use strict';

const commandLineArgs = require('command-line-args');
const { DSLParser, EvaluationSummary, PartyPipelineIterator } = require('./lib/lib');
let evaluationSummaryCSVCache = "";

const optionDefinitions = [
    { name: 'elastic-uri', alias: 'e', type: String }, // elasticsearch instance uri
    { name: 'source', alias: 's', type: String }, //Source index for the contract flags
    { name: 'destination', alias: 'd', type: String }, //Destination index for the party flags
    { name: 'flags', alias: 'f', type: String }, // Name of file containing flag definitions (should always be placed in root folder)
    { name: 'start-after', alias: 'a', type: String }, // The name or letter to start after, for continuing interrupted processes or testing
    { name: 'output-format', alias: 'o', type: String, defaultValue: "JSON" }, // The output format. Default is JSON. Alternative is CSV.
    { name: 'latency-offset-ms', alias: 'l', type: Number, defaultValue: 100 } //The time to wait for all evaluation promises to return before sending party summaries in stdout in CSV output mode
];

const args = commandLineArgs(optionDefinitions);
if(!args.flags) {
    console.error('ERROR: no flag file specified.');
    process.exit(1);
}

const elasticNode = args["elastic-uri"] || process.env.ELASTIC_URI || 'http://localhost:9200/';
let client = PartyPipelineIterator.getClient(elasticNode);


const flags = new DSLParser(args.flags).init();

const pipeline = new PartyPipelineIterator(args.source,flags);


async function aggregateParties() {
    let aggregatedSource;

    try {
        // console.log(pipeline);
        while (!aggregatedSource || aggregatedSource && aggregatedSource.aggregations.parties.buckets.length > 0) {

            let after_key = aggregatedSource ? aggregatedSource.aggregations.parties.after_key : { party: args["start-after"] };
            let searchDocument = pipeline.searchDocument(after_key);

            // console.log("aggregateParties searchDocument",JSON.stringify(searchDocument));
            aggregatedSource = await client.search(searchDocument);
            // console.log("main aggregatedSource",JSON.stringify(aggregatedSource.aggregations));
            await processAggregatedSource(pipeline,aggregatedSource);
            // console.log(a);
            // process.exit();
            // await a;
        }

        
        if (args["output-format"] != "JSON") {
            await delay(args["latency-offset-ms"]);
            
            process.stdout.write("\nWEARETHELIMITERS\n");
            process.stdout.write(evaluationSummaryCSVCache);
            // process.stdout.write("01\n");
        }
    }
    catch (e) {
        console.error("aggregateParties",e.meta ? e.meta.body ? e.meta.body.error : e : e);
    }

}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

async function processAggregatedSource(pipeline,aggregatedSource) {
    //Get parties form aggregated source
    await pipeline.getParties(aggregatedSource).map(async function(party) {

            let evaluation = new EvaluationSummary();

            let partyExtra  = pipeline.getPartyExtra({party: party, agg: aggregatedSource});
            let contractResults  = pipeline.getPartyContractResults({party: party, agg: aggregatedSource});
            // console.log("contractResults",contractResults);
    
            let partyDescription = {
            }

            Object.keys(partyExtra).map(e => {
                let fixedName = e.split(".")[e.split(".").length-1];
                partyDescription[fixedName] = partyExtra[e];
            })


            evaluation.addDescription(partyDescription);

            let evaluationPromises = pipeline.evaluate({party: party, agg: aggregatedSource});
            await evaluation.addResultsFromPipeline(evaluationPromises);

            await evaluation.addResultsFromPipeline(contractResults);
            // console.log("evaluationPromises",evaluationPromises);

            if (args["output-format"] == "JSON") {
                pipeline.out(evaluation.getEvaluation());
                if (partyDescription.id === null) {
                    console.error("\nERROR: PartyExtra returned NULL ID",party)
                    process.exit(1);
                }
            }
            else {
                evaluationSummaryCSVCache += evaluation.getSummaryCSV();
                process.stdout.write(evaluation.getEvaluationCSV());
                // process.stdout.write("00\n");

            }
            // process.exit(1);
    })

}

if (args["output-format"] != "JSON") {
    process.stdout.write(pipeline.csvPartyHeaders())
    evaluationSummaryCSVCache=pipeline.csvSummariesHeaders();
}

aggregateParties()
