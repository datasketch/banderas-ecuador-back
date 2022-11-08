#!/usr/bin/env node
'use strict';

const commandLineArgs = require('command-line-args');
const { DSLParser, PartyPipelineIterator } = require('./lib/lib');

const optionDefinitions = [
    { name: 'elastic-uri', alias: 'e', type: String }, // elasticsearch instance uri
    { name: 'source', alias: 's', type: String }, //Source index for the contract flags
    { name: 'flags', alias: 'f', type: String }, // Name of file containing flag definitions (should always be placed in root folder)
    { name: 'start-after', alias: 'a', type: String }, // The name or letter to start after, for continuing interrupted processes or testing
    { name: 'output-format', alias: 'o', type: String, defaultValue: "JSON" } // The output format. Default is JSON. Alternative is CSV.
];

const args = commandLineArgs(optionDefinitions);
if(!args.flags) {
    console.error('ERROR: no flag file specified.');
    process.exit(1);
}

const elasticNode = args["elastic-uri"] || process.env.ELASTIC_URI || 'http://localhost:9200/';
let client = PartyPipelineIterator.getClient(elasticNode);


const flags = new DSLParser(args.flags).init();


class PartySummaries {
    constructor(source,flags) {
        this.flags = flags;
        this.source = source;
    }

    async aggregateSummaries() {
        let aggregatedSource;

        try {
            // console.log(pipeline);

            let after_key = aggregatedSource ? aggregatedSource.aggregations.parties.after_key : { party: args["start-after"] };
            let searchDocument = pipeline.searchDocument(after_key);

            // console.log("aggregateSummaries searchDocument",JSON.stringify(searchDocument));
            aggregatedSource = await client.search(searchDocument);
            // console.log("main aggregatedSource",JSON.stringify(aggregatedSource.aggregations));

            if (args["output-format"] == "JSON") {
                pipeline.out(pipeline.getSummary(aggregatedSource));
            }
            else {
                process.stdout.write(pipeline.getSummaryCSV(aggregatedSource));
            }

        }
        catch (e) {
            console.error("aggregateSummaries",e.meta ? e.meta.body ? e.meta.body.error : e : e);
        }

    }


    //TODO: Parametrize aggregations in yaml
    searchDocument() {
        // console.log(this.flags);
        const searchDocument = {
            index: this.source,
            "size": 0,
            "track_total_hits": false,
            "aggs": {}
        }

        this.flags.partySummaries.map(s => {
            // console.log(s);
            const summaryName = Object.keys(s)[0];
            const summaryValue = s[summaryName];
            let summaryType;
            switch (summaryValue.type) {
                case "terms-first-bucket":
                    summaryType = "terms";
                    break;
                default:
                    summaryType = summaryValue.type;
            }
            delete summaryValue.type;

            searchDocument.aggs[summaryName] = {
                [summaryType]: summaryValue
            }
        })

        return searchDocument;
    }

    getSummary(result) {
        // console.log(JSON.stringify(result,null,4));
        let summary = {}
        Object.keys(result.aggregations).map(b => {
            let aggName = b;
            let aggValue = result.aggregations[aggName].value ? result.aggregations[aggName].value : result.aggregations[aggName].buckets[0]?.doc_count;
            summary[aggName] = aggValue;
        })

        return summary;
    }

    getSummaryCSV(result) {
        let summary = this.getSummary(result);
        let headers = "";
        Object.keys(summary).map(k => {
            headers+="'"+k+"',";
        })

        let values = "";
        Object.values(summary).map(v => {
            values+="'"+v+"',";
        })
        return headers+"\n"+values;
    }

    out(result) {
        process.stdout.write('\n');
        process.stdout.write(JSON.stringify(result));
    }

}


const pipeline = new PartySummaries(args.source,flags);



pipeline.aggregateSummaries()
