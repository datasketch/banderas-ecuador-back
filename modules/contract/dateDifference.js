const { EvaluationModule, ConditionEvaluator } = require("../../lib/lib");

class DateDifferenceEvaluationModule extends EvaluationModule {
    static moduleName = "date-difference";
    static params = [
        { name: "startDate", type: "query" },
        { name: "endDate", type: "query" },
        { name: "conditions", type: "conditionsArray" }
    ];
    static budgetByYear = null;

    constructor() {
        super()
    }
    calculateResult(parameters, result) {
        let startDate = parameters.startDate;
        let endDate = parameters.endDate;
        let condition = new ConditionEvaluator(parameters.conditions[0]);
        result.pass();

        if(!startDate || startDate.length == 0 || !endDate || endDate.length == 0) result.pass();
        else {
            // If multiple startDates, find the latest one
            let latestStartDate = null;

            if (!startDate.map) {
                startDate = [startDate];
            }

            startDate.map( date => {
                let day = date.split('T')[0];
                if(!latestStartDate || day > latestStartDate) latestStartDate = day;
            } );
            // If multiple endDates, find the earliest one
            let earliestEndDate = null;

            if (!endDate.map) {
                endDate = [endDate];
            }

            endDate.map( date => {
                let day = date.split('T')[0];
                if(!earliestEndDate || day > earliestEndDate) earliestEndDate = day;
            } );

            let start = new Date(latestStartDate);
            let end = new Date(earliestEndDate);
            let timeDifference  = end - start;
            let dayDifference = timeDifference / (1000 * 3600 * 24);

            if( condition.evaluate(dayDifference) ) result.fail();
        }

        return result;
    }
}


module.exports = {DateDifferenceEvaluationModule}
