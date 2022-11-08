#!/usr/bin/env node
'use strict';

const simdjson = require('simdjson');
const es = require('event-stream');
const commandLineArgs = require('command-line-args');
const { DSLParser, PartyPipelineIterator } = require('./lib/lib');

const optionDefinitions = [
    { name: 'flags', alias: 'f', type: String } // Name of file containing flag definitions (should always be placed in root folder)
];
const args = commandLineArgs(optionDefinitions);
if(!args.flags) {
    console.error('ERROR: no flag file specified.');
    process.exit(1);
}

const flags = new DSLParser(args.flags).init({preprocess: true});

const pipeline = new PartyPipelineIterator("",flags);

// Como es el proceso de preproceso
// 1. Lee documento del stream, es una evaluacion de un contrato
// 2. Se inicializa el pipeline de preprocesos
// 4. Agarro el primer elemento del pipeline y le mando el documento entero
// 5. El elemento del pipeline procesa el documento, acumulando lo que requiera
// 8. Iterar por todo el pipeline para este mismo documento.
// 9. Cuando se termina de procesar, se guarda un archivo con la salida de cada EvaluationModule, que sera retomada en partyEvaluation


process.stdin.setEncoding('utf8');
process.stdin
    .pipe(es.split())
    .pipe(es.map(function (doc,cb) {
        if (doc) { cb(null,simdjson.parse(doc)); }
        else cb(null, null);
    }))
    .pipe(es.map(preprocess))

function preprocess(doc) {
    pipeline.preprocess(doc);
}

process.stdin.on('end', () => {
    pipeline.preprocessWrite();
    process.stdout.write('\n');
    // process.exit(0);
});
