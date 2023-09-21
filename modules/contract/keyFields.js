const { EvaluationModule } = require("../../lib/lib");


class KeyFieldsEvaluationModule extends EvaluationModule {
    static moduleName = "key-fields";
    static params = [
        { name: "resultType", type: "value" },
        { name: "values", type: "queryArray" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let failedFields = 0;
        let presenceRatio = 0;
        result.pass();

        parameters.values.map( param => {
            if(!param || param.length == 0) {
                result.fail();
                failedFields++;
            }
            else if(param.length > 0 && typeof(param)!="string") {
                let failed = false;
                param.map( p => {
                    if(!p || p == "null") {
                        result.fail();
                        failed = true;
                    }
                } );
                if(failed) failedFields++;
            }
        } );
        presenceRatio = (parameters.values.length - failedFields) / parameters.values.length;
        result.addResultDetails('presenceRatio', presenceRatio);

        if(parameters.resultType == "ratio") result.setResult(presenceRatio);

        return result;
    }
}


module.exports = {KeyFieldsEvaluationModule}
