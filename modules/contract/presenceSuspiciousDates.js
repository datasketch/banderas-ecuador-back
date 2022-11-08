const { EvaluationModule } = require("../../lib/lib");


class PresenceSuspiciousDatesEvaluationModule extends EvaluationModule {
    static moduleName = "presence-suspicious-dates";
    static params = [
        { name: "values", type: "queryArray" },
        { name: "comparisonValues", type: "value" },
        { name: "options", type: "value" }
    ];
    static optionsObj = {}
    suspiciousDates;

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let dates = parameters.values;
        this.suspiciousDates = parameters.comparisonValues;
        if(Object.keys(PresenceSuspiciousDatesEvaluationModule.optionsObj).length == 0) this.setOptions(parameters.options);
        result.pass();

        // console.log(dates.length);
        // process.exit()
        if(dates.length > 0 && this.suspiciousDates.length > 0) {
            if (dates.map) {
                if (dates.map( d => this.checkDate(d[0]) ).indexOf(false) > -1) {
                    result.fail();

                }
            }
            else {
                if(!this.checkDate(dates)) {
                    result.fail();
                }
            }
        }
        return result;
    }
    checkDate(d) {
        if(d) {
            let dateDay = d.split('T')[0];
            if( this.suspiciousDates.indexOf(dateDay) >= 0 ) return false;
            else {
                if(PresenceSuspiciousDatesEvaluationModule.optionsObj.hasOwnProperty('includeSundays') && PresenceSuspiciousDatesEvaluationModule.optionsObj.includeSundays) {
                    if(this.isSunday(d)) return false;
                }
            }
        }
        return true;
    }
    setOptions(optionArray) {
        if(optionArray && optionArray.length > 0) {
            optionArray.map( option => {
                Object.assign(PresenceSuspiciousDatesEvaluationModule.optionsObj, option);
            } )
        }
    }
    isSunday(dateString) {
        let day = new Date(dateString).getDay();
        if(day == 0) return true;
        return false;
    }
}


module.exports = {PresenceSuspiciousDatesEvaluationModule}
