const { EvaluationModule } = require("../../lib/lib");


class InformationMatchesEvaluationModule extends EvaluationModule {
    static moduleName = "information-matches";
    static params = [
        { name: "values", type: "query" },
        { name: "properties", type: "value" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        result.pass();
        let values = parameters.values;
        let properties = parameters.properties;

        for (let i = 0; i < values.length; i++) {
            for (let k = i + 1; k < values.length; k++) {
                let matches = properties.map( p => { return values[i].hasOwnProperty(p) && values[k].hasOwnProperty(p) && values[i][p] == values[k][p] } );
                if( matches.indexOf(false) < 0 ) result.fail();
            }
        }
        return result;
    }
}


module.exports = {InformationMatchesEvaluationModule}
