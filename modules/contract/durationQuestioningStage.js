const { EvaluationModule } = require("../../lib/lib");


class DurationQuestioningStageEvaluationModule extends EvaluationModule {
    static moduleName = "duration-questioning-stage";
    static params = [
        { name: "duration", type: "query" },
        { name: "procurementMethod", type: "query" },
        { name: "date", type: "query" },
        { name: "amount", type: "query" },
        { name: "budgetByYear", type: "value" }
    ];
    static budgetByYear = null;

    constructor() {
        super()
    }
    calculateResult(parameters, result) {
        let duration = parameters.duration[0];
        let procurementMethod = parameters.procurementMethod[0];
        let date = parameters.date[0];
        let amount = parameters.amount[0];
        if(!DurationQuestioningStageEvaluationModule.budgetByYear) DurationQuestioningStageEvaluationModule.budgetByYear = this.parseBudgets(parameters.budgetByYear);
        result.pass();

        if(duration && date && procurementMethod && amount) {
            let year = date.split('-')[0];
            if(this.durationTooShort(duration, procurementMethod, year, amount)) result.fail();
        }
        return result;
    }
    parseBudgets(budgetList) {
        let budgets = {}
        if(budgetList.length > 0) {
            budgetList.map( b => {
                budgets[ Object.keys(b)[0] ] = b[Object.keys(b)[0]];
            } )
        }
        return budgets;
    }
    durationTooShort(duration, procurementMethod, year, amount) {
        let coefficient = amount / DurationQuestioningStageEvaluationModule.budgetByYear[year];

        switch(procurementMethod) {
            case 'Lista corta':
            case 'Concurso publico':
                if( coefficient > 0.000002 && coefficient < 0.000007 && duration < 3  ) return true;
                if( coefficient > 0.000007 && coefficient < 0.00003  && duration < 5  ) return true;
                if( coefficient > 0.00003  && coefficient < 0.0002   && duration < 7  ) return true;
                if( coefficient > 0.0002                             && duration < 10 ) return true;
                break;
            case 'Cotizaci??n':
                if( coefficient > 0.000002 && coefficient < 0.000007 && duration < 3  ) return true;
                if( coefficient > 0.000007 && coefficient < 0.00003  && duration < 5  ) return true;
                break;
            case 'Licitaci??n':
                if( coefficient > 0.000015 && coefficient < 0.0002   && duration < 5  ) return true;
                if( coefficient > 0.0002                             && duration < 10 ) return true;
                break;
            case 'Subasta Inversa Electr??nica':
                if( coefficient > 0.0000002 && coefficient < 0.000002 && duration < 2   ) return true;
                if( coefficient > 0.000002  && coefficient < 0.000007 && duration < 3   ) return true;
                if( coefficient > 0.000007  && coefficient < 0.00003  && duration < 5   ) return true;
                if( coefficient > 0.00003   && coefficient < 0.0002   && duration < 7   ) return true;
                if( coefficient > 0.0002                              && duration < 10  ) return true;
                break;
            case 'Menor Cuant??a':
                if( coefficient < 0.000002 && duration < 2  ) return true;
                break;
            default:
                return false;
        }

        return false;
    }
}


module.exports = {DurationQuestioningStageEvaluationModule}
