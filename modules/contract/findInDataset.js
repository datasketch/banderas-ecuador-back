const { EvaluationModule } = require("../../lib/lib");


class FindInDatasetEvaluationModule extends EvaluationModule {
    static moduleName = "find-in-dataset";
    static params = [
        { name: "field", type: "query" },
        { name: "additionalId", type: "value"},
        { name: "additiontalDataField", type: "value"},
    ];

    constructor(rule) {
        super(rule)
    }

    calculateResult(parameters,result) {
        result.pass();

        this.additionalData[parameters.additionalId].map(additionalItem => {
            // console.log(parameters.field, additionalItem[parameters.additiontalDataField]);
            if (parameters.field.length > 0 && additionalItem[parameters.additiontalDataField].length > 0) {
                if (additionalItem[parameters.additiontalDataField].indexOf(parameters.field) > -1) {
                    result.fail();
                }
            }
        })

        return result;
    }
}


module.exports = {FindInDatasetEvaluationModule}
