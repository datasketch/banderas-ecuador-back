#!/usr/bin/env node
'use strict';

const simdjson = require('simdjson');
const es = require('event-stream');
const commandLineArgs = require('command-line-args');
const { DSLParser, EvaluationSummary, PipelineIterator } = require('./lib/lib');

const optionDefinitions = [
    { name: 'flags', alias: 'f', type: String } // Name of file containing flag definitions (should always be placed in root folder)
];
const args = commandLineArgs(optionDefinitions);
if(!args.flags) {
    console.error('ERROR: no flag file specified.');
    process.exit(1);
}

const parser = new DSLParser(args.flags).init();

const pipeline = new PipelineIterator(parser);

// Como es el proceso de evaluación de un contrato
// 1. Lee documento del stream
// 2. Se crea una copia del template de evaluación de contratos.
// 3. Se copian los campos del contrato que el DSL defina a la copia del template de evaluación.
// 4. Agarro el primer elemento del pipeline y le mando el documento entero y el documento de evaluación de contratos.
// 5. El elemento del pipeline procesa el documento, aplica FilterValue sobre el documento y devuelve sólo los valores requeridos para el evaluador
// 6. El EvaluationModule recibe los valores y valores esperados y produce un resultado.
// 7. El resultado de la evaluación se guarda en el documento de evaluación.
// 8. Iterar por todo el pipeline para este mismo documento.
// 9. Se devuelve un documento de evaluación completo.
// 10. Se envia el documento de evaluación por el stream de salida

// let rulesPath = "./flags.json"; //TODO: This from args
// console.log("lib",lib);
// const rules = new DSLParser(rulesPath);
// const pipeline = new lib.PipelineIterator(rules);

process.stdin.setEncoding('utf8');
process.stdout._handle?.setBlocking(true);
process.stdin
    .pipe(es.split())
    .pipe(es.map(function (doc,cb) {
        if (doc) { cb(null,simdjson.parse(doc)); }
    }))
    .pipe(es.map(async function (doc,cb) {
        let evaluation = new EvaluationSummary();
        evaluation.addDescription(pipeline.getContractFields(parser.contractFields,doc));
        // pipeline.evaluate(doc).map(result => evaluation.addResult(result));

        let evaluationPromises = pipeline.evaluate(doc);
        await evaluation.addResultsFromPipeline(evaluationPromises)
        // console.log("evaluationPromises",evaluationPromises);

        cb(null,evaluation.getEvaluation());
    }))
    .pipe(es.map(function (doc,cb) {
        cb(null,JSON.stringify(doc) + "\n");
    }))
    .pipe(process.stdout);

process.stdin.on('end', () => {
    process.stdout.write('\n');
    // process.exit(0);
});
