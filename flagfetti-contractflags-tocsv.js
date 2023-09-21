#!/usr/bin/env node
'use strict';

const simdjson = require('simdjson');
const es = require('event-stream');

let headersSent = false;

process.stdin.setEncoding('utf8');
process.stdout._handle?.setBlocking(true);
process.stdin
    .pipe(es.split())
    .pipe(es.map(function (doc,cb) {
        if (doc) { cb(null,simdjson.parse(doc)); }
    }))
    .pipe(es.map(async function (doc,cb) {
        let out = "";

        //Se unifican los proveedores e items de todos los awards
        let awardFields = {
            "awards_suppliers_name": doc["description"].awards.map(a=> a.suppliers? a.suppliers.map(i=>i.name) : ""),
            "awards_items_description": doc["description"].awards.map(a=> a.items ? a.items.map(i=>i.description) : ""),
            "awards_items_classification_id": doc["description"].awards.map(a=> a.items ? a.items.map(i=>i.classification ? i.classification.id : "") : ""),
        }

        //Se corrige el amount para que sea la suma del amount de todos los awards
        doc["description"].amount = doc["description"].awards.map(a=> a.value ? a.value.amount : 0).reduce((a,b)=> a+b , 0 );

        //Se extraen los preseceRatios para exportarlos por separado
        let resultFields = {
            "key-fields-traceability-presenceRatio": doc["results"]["key-fields-traceability"].details.presenceRatio,
            "key-fields-temporality-presenceRatio": doc["results"]["key-fields-temporality"].details.presenceRatio,
            "planning-sections-presenceRatio": doc["results"]["planning-sections"].details.presenceRatio
        }


        let unified = { ... doc["description"], ... awardFields, ...doc["summary"], ...doc["results"], ... resultFields }

        //Eliminar total score, parties y summaries
        delete unified.total_score;
        delete unified["parties"];
        delete unified["awards"];

        if (!headersSent) {
            out += Object.keys(unified).join(",")+"\n";
            headersSent= true;
        }
        out += Object.values(unified).map((value) => {
            if (value) {
                // console.log(value, value.indexOf)
                if (value.indexOf) {
                    // console.log(value.indexOf(","))
                }
            }
            if (value && value.toString() == "[object Object]") {  return value.result}
            else {
                if (value && value.join) {
                    value=value.join(";");
                }
                if (value && value.indexOf) {
                    value = value.replace(/\"/g,"'");
                    if(value.indexOf("\n") > -1) {
                        value = value.replace(/[\r\n]/gm, " ");
                        value = value.replace(/\s{2,}/g, " ");
                    }
                    if(value.indexOf(",") > -1) {
                        value = '"'+value+'"';
                    }
                }
                return value
            }} ).join(",")+"\n";

        cb(null,out)
    }))
    .pipe(process.stdout);

process.stdin.on('end', () => {
    process.stdout.write('\n');
    // process.exit(0);
});
