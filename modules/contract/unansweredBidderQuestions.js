const { EvaluationModule } = require("../../lib/lib");


class UnansweredBidderQuestionsEvaluationModule extends EvaluationModule {
    static moduleName = "unanswered-bidder-questions";
    static params = [
        { name: "enquiries", type: "query" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let enquiries = parameters.enquiries;
        if(enquiries.length > 0) {
            enquiries.map( e => {
                if(!e.hasOwnProperty('answer')) result.fail();
            } )
        }
        return result;
    }
}


module.exports = {UnansweredBidderQuestionsEvaluationModule}
