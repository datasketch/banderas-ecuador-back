const { PartyEvaluationModule } = require("../../lib/lib");

class NetworkPartyEvaluationModule extends PartyEvaluationModule {
    static moduleName = "network";
    static params = [
      { name: "field", type: "value"}
      , 
      { name: "contrapartiesField", type: "value" }
    ];
    static contraparties = null;

    constructor() {
        super()
    }
    getAgg(params) {
        let agg = {
            contraparties: {
                "terms": {
                    field: params.contrapartiesField

                }
            }

        }
        return agg;

    }

    async calculateResult(parameters,result) {
        let contraparties_ids = parameters.agg.contraparties.buckets.map(c => c.key)
        // console.log(contraparties_ids);
        await this.getReliabilityScore(contraparties_ids, parameters, result);

        // console.log(JSON.stringify(result));
        // process.exit();

        // result.setResult(score);
        return result;
        // console.log(this);
        // return 1;
        // return 1;
    }

    async getReliabilityScore(contraparties_ids,params, result) {
        let searchDocument = {
            "index": params.source,
            "size": 0, 
            "aggs": {
              "party": {
                "terms": {
                  "field": params.contrapartiesField
                },
                "aggs": {
                  "network_contracts_per_year": {
                    "date_histogram": {
                      "field": "description.date",
                      "calendar_interval": "year",
                      "format": "yyyy",
                      "min_doc_count": 1
                    },
                    "aggs": {
                      "year_score": {
                        "avg": {
                          "field": "summary.total_score"
                        }
                      }
                    }
                  }
                }
              }
            }, 
            "query": {
              "terms": {
                [params.contrapartiesField]: contraparties_ids
              }
            }
          }
        let client = this.getClient();

        let relQuery = await client.search(searchDocument);
        // let total_score = relQuery.aggregations.total_score

        let network_score;
        // console.log(JSON.stringify(relQuery.aggregations,null,4));

        if (relQuery.aggregations.party.buckets.length == 0) {
          result.pass();
          return;
        }
        else {
          let contraparties = relQuery.aggregations.party.buckets;
          let contraparties_years = contraparties.map(b=>b.network_contracts_per_year);
          let years_scores = {};
          for (let c in contraparties_years) {
            for (let y in contraparties_years[c].buckets) {
              let year_contraparty = contraparties_years[c].buckets[y];
              // console.log(c,y,year_contraparty);
              // process.exit();
              if (!years_scores[year_contraparty.key_as_string]) {
                years_scores[year_contraparty.key_as_string] = []
              }
              years_scores[year_contraparty.key_as_string].push(year_contraparty.year_score.value); 
            }
          }

          Object.keys(years_scores).map(y => {
            let year_score = years_scores[y].reduce((a,b)=>a+b) / years_scores[y].length;
            result.setResultYear(year_score,y);
          })

        }

        // return network_score;

    }

}

module.exports = {NetworkPartyEvaluationModule }
