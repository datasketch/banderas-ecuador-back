const { EvaluationModule } = require("../lib/lib");

class DemoEvaluator extends EvaluationModule {
    static moduleName = "demo"

    constructor() {
        super()
    }

    evaluate(parameters, rule, category) {
        // console.log(this,"process");
        let result = new EvaluationResult();
        result.rule = rule;
        result.category = category;
        result.result = this.calculateResult(parameters);
        return result;
    }
    calculateResult(parameters) {
        //TODO
        return 1;
    }
}

module.exports = {DemoEvaluator}