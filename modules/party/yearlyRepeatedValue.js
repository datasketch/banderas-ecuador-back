const { PartyEvaluationModule, ConditionEvaluator } = require("../../lib/lib");


/*
Hacer un date histogram, tomar fecha con mayor cantidad y comparar con cantidad total, ver si es mayor al límite.

Una dependencia realiza el 30% de sus contratos del año en un mismo día. No aplica si hay diez o menos contratos al año

A unit performs 30% of its contracts for the year on the same day. Does not apply if there are ten or less contracts per year
*/


class YearlyRepeatedValue extends PartyEvaluationModule {
    static moduleName = "yearly-repeated-value";
    static params = [
        { name: "field", type: "value"},
        { name: "conditions", type: "conditionsArray" }
    ];

    constructor() {
        super()
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

        //For date fields we will not use terms agg, but date_histogram
        if (params.field.indexOf("date") == -1) {
            agg.contracts_per_year.aggs = { 
                ["values-"+params.field]: {
                    "terms": {
                        "field": params.field,
                        "size": 2,
                        "order": { "_count": "desc" }
                    },
                },
            }

        }

        else {
            agg.contracts_per_year.aggs = { 
                ["values-"+params.field]: {
                    "date_histogram": {
                        "field": params.field,
                        "calendar_interval": "day",
                        "format": "yyyy-MM-dd",
                        "order": { "_count": "desc" },
                        "min_doc_count": 1
                    }   
                }
            }
        }
        return agg;
    }

    calculateResult(parameters,result) {
        parameters.agg.contracts_per_year.buckets.map(year => {

            //Contract count only requires the number to be passed, ignores the rest of the code
            // console.log(parameters.conditions[0]);
            if (parameters.conditions[0].contract_count == true) {
                result.setResultYear(year.doc_count,year.key_as_string);
                return result;
            }

            let minValuesCondition = new ConditionEvaluator(parameters.conditions[1]);

            //Only in years with the minium contract count
            if (minValuesCondition.evaluate(year.doc_count)) {

                //Find day with most contracts
                let maxValues = year["values-"+parameters.field].buckets[0];
                let condition = new ConditionEvaluator(parameters.conditions[0]);

                // console.log("YearlyRepeatedValue",year);
                //Calculate ratio
                if (maxValues) {
                    let maxValuesRatio = maxValues.doc_count/year.doc_count;
    
                    
                    //Fail if condition is met
                    if( condition.evaluate(maxValuesRatio) ) result.fail_year(year.key_as_string,'maxValuesRatio', maxValuesRatio);
                    else result.pass_year(year.key_as_string,'maxValuesRatio', maxValuesRatio);
                }
                else {
                    result.fail_year(year.key_as_string,'emptyTitle', true);
                }
            }
        })
        return result;
    }
}

module.exports = {YearlyRepeatedValue }
