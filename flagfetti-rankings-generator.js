const commandLineArgs = require('command-line-args');
const { PartyPipelineIterator } = require('./lib/lib');
const fs = require("fs");

const optionDefinitions = [
    { name: 'elastic-uri', alias: 'e', type: String }, // elasticsearch instance uri
    { name: 'source', alias: 's', type: String }, //Source index for the contract flags
    { name: 'destination', alias: 'd', type: String }, //Path and filename prefix Destination index for the party flags
];

const args = commandLineArgs(optionDefinitions);

// process.stdout.setEncoding('utf8');
process.stdout._handle?.setBlocking(true);


const elasticNode = args["elastic-uri"] || process.env.ELASTIC_URI || 'http://localhost:9200/';
const source = args["source"] || 'ec_party_flags';
const path = args["destination"] || './ec-rankings-';

let client = PartyPipelineIterator.getClient(elasticNode);

function yearRanking(year) {

    const searchDocument =
    {
        "index": source,
        "filter_path": "hits.hits.fields",
        "size": 20,
        "query": {
            "bool": {
                "must": [
                    {
                        "range": {
                            ["summary_years." + year + ".contract-count"]: {
                                "gte": 100
                            }
                        }

                    },
                    {
                        "match": {
                            "description.roles.keyword": "buyer"
                        }
                    }

                ]
            }
        }, 
        "runtime_mappings": {
          ["total_score_"+year]: {
            "type": "double",
            "script": "emit((doc['summary_years." + year + ".comp'].value + doc['summary_years." + year + ".trans'].value + doc['summary_years." + year + ".traz'].value + doc['summary_years." + year + ".network'].value + doc['summary_years." + year + ".temp'].value)/5)"
          }
        },  
        "sort": [
          {
            ["total_score_"+year]: {
              "order": "desc"
            }
          }
        ],
        "_source": false, 
        "fields": [
            "total_score_"+year,
            "description.*.keyword",
            "summary_years." + year + ".*"

        ]
    }


    let csvOut = "";
    let rankingQuery = client.search(searchDocument).then(res => {
        fields = Object.keys(res.hits.hits[0].fields).sort();

        headers = ["description_buyer_ids",
            "description_locality",
            "name",
            "description_region",
            "description_roles",
            "summary_comp",
            "n",
            "summary_network",
            "summary_temp",
            "summary_trans",
            "summary_traz",
            "summary_total_score_"+year,
        ]
        csvOut += headers.join(",");
        csvOut += "\n";

        csvOut += res.hits.hits.map(r => {
            return fields.map(f => {
                if (r.fields[f] && r.fields[f][0]) {
                    if (r.fields[f][0].indexOf && r.fields[f][0].indexOf(",") > -1) {
                        r.fields[f][0] = '"' + r.fields[f][0] + '"';
                    }
                    return r.fields[f][0];
                }
            })
        }).join("\n");

        csvOut += "\n";
        fs.writeFileSync(
            path + year + ".csv",
            csvOut
        )

    })
}

const now = new Date();
const year = now.getFullYear();

yearRanking(year - 1)
yearRanking(year)