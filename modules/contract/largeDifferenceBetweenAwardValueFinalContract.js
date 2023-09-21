const { EvaluationModule, ConditionEvaluator } = require("../../lib/lib");


class LargeDifferenceBetweenAwardValueFinalContractEvaluationModule extends EvaluationModule {
    static moduleName = "large-difference-between-award-value-final-contract";
    static params = [
        { name: "value", type: "query" },
        { name: "referenceValue", type: "query" },
        { name: "conditions", type: "conditionsArray" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let value;
        if (parameters.value) {
            value = parameters.value;
        }
        let referenceValue;
        if (parameters.referenceValue) {
            referenceValue = parameters.referenceValue;
        }
        let condition = new ConditionEvaluator(parameters.conditions[0]);
        let awardValues = value.reduce((partialSum, a) => partialSum + a, 0);
        let refValues = referenceValue.reduce((partialSum, a) => partialSum + a, 0);

        if(awardValues && refValues) {
            let percentDifference = Math.abs(awardValues - refValues) / refValues * 100;
            if( condition.evaluate(percentDifference) ) result.fail();
            else result.pass();
            result.addResultDetails('percentDifference', percentDifference);
        }
        return result;
    }
}


module.exports = {LargeDifferenceBetweenAwardValueFinalContractEvaluationModule}
