const { PartyEvaluationModule, ConditionEvaluator } = require("../../lib/lib");
/*
The same bidder has more than one identification number assigned with the same name
Un mismo licitador tiene más de un número de identificación asignado con el mismo nombre

*/

class DuplicatedIdPartyEvaluationModule extends PartyEvaluationModule {
    static moduleName = "duplicated-id";
    static params = [
        { name: "conditions", type: "conditionsArray" }
    ];
    localPreprocessed = {};

    constructor(rule) {
        super(rule)
    }

    getAgg(params) {
        // console.log("getAgg",params);
        let agg = {
            "contracts_per_year": {
                "date_histogram": {
                    "field": "description.date",
                    "calendar_interval": "year",
                    "format": "yyyy" ,
                    "min_doc_count": 1
                },

                "aggs": {

                }
            },
        }

        return agg;
    }

    preprocess(doc, rule) {
        if(!doc) return;
        let desc = doc.description;
        // console.log("each",desc.parties);
        //Acumular supplier ids
        for (let i in desc.parties) {
            let p = desc.parties[i];
            if (p.roles.indexOf("supplier") > -1) {
                if (!this.localPreprocessed[p.name]) {
                    this.localPreprocessed[p.name] = {
                        name: p.name,
                        ids: [],
                        id_count: 0,
                        years: []
                    }
                }
                if (this.localPreprocessed[p.name].ids.indexOf(p.id) == -1) {
                    this.localPreprocessed[p.name].ids.push(p.id);
                    this.localPreprocessed[p.name].id_count = this.localPreprocessed[p.name].ids.length;
                }

            }
        }
    }

    getPreprocessed(rule) {
        let parties = Object.keys(this.localPreprocessed)
        for (let p in parties) {
            let id_count = this.localPreprocessed[parties[p]].id_count;
            // console.log(rule)

            let condition = new ConditionEvaluator(rule.parameters.conditions[0]);

            //Output to dataset if condition is met
            if( condition.evaluate(id_count) ) {
                this.preprocessed[parties[p]] = this.localPreprocessed[parties[p]];
            }
        }
        return this.preprocessed;
    }

    async calculateResult(parameters,result) {

        // Acá lo que hay que evaluar es si la party está en el dataset
        let resultValue = 1;

        //Si es un supplier con dos id que viene del dataset preprocesado
        if (this.additionalData.preprocessed.hasOwnProperty(parameters.party)) {
            result.fail();
            resultValue = 0;
            result.addResultDetails("ids",this.additionalData.preprocessed[parameters.party]);
            // console.log(this.result);
        }
        else result.pass();

        parameters.agg.contracts_per_year.buckets.map(year => {
            result.setResultYear(resultValue, year.key_as_string);
        });

        return result;
    }

}

module.exports = {DuplicatedIdPartyEvaluationModule }
