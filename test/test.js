var assert = require('assert');
var expect = require('expect.js');
const { DSLParser, EvaluationModule, EvaluationResult } = require('../lib/lib');
const { BiddersWhoBidAndDontWinEvaluationModule } = require('../modules/contract/biddersWhoBidAndDontWin');

describe("DSLParser", function() {
    describe("parse", function() {
        it('should fail on malformed yaml', function() {
            let parser = new DSLParser();
            expect(() => {
                parser.parse("hola");
            }).to.throwException(/Malformed YAML DSL. Kind and spec are required./)
        })
    })
})

describe("EvaluationModules", function() {
    describe("Generic", function() {
        it('should return not be instantiatable EvaluationResult', function() {
            expect(() => {
                let evaluationModule = new EvaluationModule();
            }).to.throwException(/Cannot instantiate abstract class/)
        })
    })
    describe("One module", function() {
        it('should return an EvaluationResult', function() {
            let evaluationModule = new BiddersWhoBidAndDontWinEvaluationModule();
            let result = evaluationModule.evaluate({}, {name: "test", category: "test", default: 0.5});
            assert(Object.getPrototypeOf(result) === EvaluationResult.prototype, true);
        })
    })
})



//TODO: Things to test:
//load yaml
//load malformed yaml
//load yaml with inexistent module
//load yaml with existent module
//load yaml with wrong parameters for module
//load yaml with inexistent json path
//load yaml with existent json path
//stream with empty document
//stream with malformed document
//stream with OCDS document
//stream to stram2db
//failed elastic connection
//successful elastic
//get contract evaluations from elastic
//produce party evaluations from elastic
//test each module with wrong parameters
//test each module with correct parameters
