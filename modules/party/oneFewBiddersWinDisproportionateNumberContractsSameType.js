const { PartyEvaluationModule, ConditionEvaluator } = require("../../lib/lib");

/*
One or a few bidders win a disproportionate number of contracts of the same type

Uno o pocos licitadores obtienen un número desproporcionado de contratos del mismo tipo

"Se podría utilizar el campo releases.awards.suppliers.id para filtrar la búsqueda y verificar si uno o poco oferentes reciben muchos contratos del mismo tipo.

Se utiliza el campo releases.awards.items.classification.description para complementar la verificación del id en CPC."

"A nivel entidad y cpc a nivel 5
índice de Herfindahl-Hirschman.
HHI = Suma (cuota de mercado ^ 2)
Los valores superiores a 4000 indican una concentración más alta."

//Hay que agregar de base por items id y después por parties - ahí vemos la distribución por party con la fórmula

//Todos los productos de un mismo buyer
//Monto total gastado en cada producto por el mismo buyer
//Distribución entre proveedores del monto total
//si la flag se levanta para un buyer hay que aplicarlo el supplier que hizo saltar la bandera (es decir no debe saltar para concentración de buyers en un supplier)


*/
class OneFewBiddersWinDisproportionateNumberContractsSameTypePartyEvaluationModule extends PartyEvaluationModule {
    static moduleName = "one-few-bidders-win-disproportionate-number-contracts-same-type";
    static params = [
        { name: "field", type: "value" },
        { name: "conditions", type: "conditionsArray" }
    ];
    localPreprocessed = {}

    constructor(rule) {
        super(rule)
    }

    //Acumular importes por item por supplier
    preprocess(doc,rule) {
        if(!doc) return;
        if (!doc.description.awards) {
            return;
        }

        let desc = doc.description;

        let buyer_name = desc.buyer_names;

        //Accumulate buyers
        if (!this.localPreprocessed.hasOwnProperty(buyer_name)) {
            this.localPreprocessed[buyer_name] = {
                name: buyer_name,
                years: {}
            }
        }

        for (let i in desc.awards) {

            let date = desc.awards[i].date || desc.date;
            // console.log(date);
            let year = date.substr(0,4);


            //Accumulate years
            if (!this.localPreprocessed[buyer_name].years[year]) {
                this.localPreprocessed[buyer_name].years[year] = {
                    year: year,
                    items: {}
                }
            }


            for (let ii in desc.awards[i].items) {
                let item = desc.awards[i].items[ii];


                //Accumulate items per buyers
                if (!this.localPreprocessed[buyer_name].years[year].items[item.id]) {
                    this.localPreprocessed[buyer_name].years[year].items[item.id] = {
                        id: item.id,
                        contract_count: 0,
                        quantity: 0,
                        amount: 0,
                        suppliers: {}
                    }
                }

                let items = this.localPreprocessed[buyer_name].years[year].items;

                items[item.id].contract_count++;

                //Quantity of one item per buyer
                items[item.id].quantity += item.quantity;

                //Amount of one item per buyer
                let itemAmount;
                // console.log(desc.ocid);
                if (item.unit?.value || item.unit?.correctedValue) {
                    itemAmount = item.quantity * (item.unit.value?.amount  || item.unit.correctedValue?.amount );
                }
                else if (item.quantity == 1 && (desc.awards[i].value || desc.awards[i].correctedValue ) ) {
                    itemAmount = desc.awards[i].value?.amount  || desc.awards[i].correctedValue.amount;

                }
                if (itemAmount) {
                    items[item.id].amount += itemAmount;
                }

                //Iterate suppliers
                for (let si in desc.awards[i].suppliers) {
                    let supplierName = desc.awards[i].suppliers[si].name;
                    // console.log(supplierName);

                    //Accumulate suppliers for one item per buyer
                    if (!items[item.id].suppliers[supplierName]) {
                        items[item.id].suppliers[supplierName] = {
                            quantity: 0,
                            amount: 0
                        }
                    }

                    //Quantity of one supplier per item per buyer
                    items[item.id].suppliers[supplierName].quantity += item.quantity;

                    //Amount of one supplier per item per buyer
                    if (itemAmount) {
                        items[item.id].suppliers[supplierName].amount += itemAmount;
                    }
                    // console.log(this.localPreprocessed[item.id].suppliers)
                }

            }
        }

        // console.log(JSON.stringify(this.localPreprocessed, null, 4));

    }

    getPreprocessed(rule) {
        Object.values(this.localPreprocessed).map(buyer => {
            let buyer_name = buyer.name;

            Object.values(buyer.years).map(year => {
                let yearExceededSuppliers = this.calculateExceededSuppliers(year,rule);
                // console.log(year.year);
                if (yearExceededSuppliers.length > 0) {
                    if (!this.preprocessed[buyer_name]) {
                        this.preprocessed[buyer_name] = {
                            years: {}
                        }
                    }
                    this.preprocessed[buyer_name].years[year.year] = yearExceededSuppliers;

                    for (let s in yearExceededSuppliers) {
                        let supplier_name = Object.keys(yearExceededSuppliers[s])[0]
                        let supplier_summary = yearExceededSuppliers[s]

                        if (!this.preprocessed[supplier_name]) {
                            this.preprocessed[supplier_name] = {
                                years: {}
                            }
                        }

                        let supplier_item = {
                            [supplier_summary.item.id]: {
                                "supplier_percentage": supplier_summary[supplier_name].percentage,
                                "buyer": buyer_name,
                                "item": supplier_summary.item
                            }
                        };
                        if (!this.preprocessed[supplier_name].years[year.year]) {
                            this.preprocessed[supplier_name].years[year.year] = supplier_item;
                        }
                        else {
                            if (this.preprocessed[supplier_name].years[year.year][supplier_summary.item.id]) {
                                if (this.preprocessed[supplier_name].years[year.year][supplier_summary.item.id].supplier_percentage < supplier_summary[supplier_name].percentage) {
                                    Object.assign(this.preprocessed[supplier_name].years[year.year], supplier_item);
                                }
                            }
                            else {
                                Object.assign(this.preprocessed[supplier_name].years[year.year], supplier_item);
                            }
                        }


                    }
                    // console.log(JSON.stringify(this.preprocessed, null, 4));
                    // process.exit(1);
                }

            })
        })
        return this.preprocessed;
    }

    calculateExceededSuppliers(year,rule) {
        // Acá se hace la cuenta
        // "A nivel entidad y cpc a nivel 5
        // índice de Herfindahl-Hirschman.
        // HHI = Suma (cuota de mercado ^ 2)
        // Los valores superiores a 4000 indican una concentración más alta."

        let yearExceededSuppliers = [];

        // console.log(JSON.stringify(buyer, null, 4));

        for (let i in Object.keys(year.items)) {
            let ii = Object.keys(year.items)[i];
            let item = year.items[ii];

            // console.log(item)

            //TODO: Take value from yaml
            if (item.contract_count < rule.parameters.conditions[1].min_item_contract_count) {
                continue;
            }
            else {
                //Init HHI calculation for this item
                item.hhi = 0;
                item.max_supplier = null;

                for (let s in Object.keys(item.suppliers) ) {
                    let ss = Object.keys(item.suppliers)[s];
                    let supplier = item.suppliers[ss];
                    supplier.percentage = ( supplier.amount / item.amount ) * 100;
                    supplier.percentage_sq = supplier.percentage ** 2;
                    item.hhi += supplier.percentage_sq;

                    if ((item.max_supplier ? item.max_supplier.percentage_sq : 0) < supplier.percentage_sq) {
                        item.max_supplier = {
                            [ss]: supplier,
                            "percentage_sq": supplier.percentage_sq,
                            "item": {
                                "hhi": item.hhi,
                                "id": item.id
                            },
                        }
                        // console.log("item",item);
                    }
                }
                let condition = new ConditionEvaluator(rule.parameters.conditions[0]);

                if (condition.evaluate(item.hhi)) {
                    yearExceededSuppliers.push(item.max_supplier);
                }
                // console.log(item);
            }
        }


        return yearExceededSuppliers;

    }

    getAgg(params) {
        // console.log("getAgg",params);
        let agg = {
            "year_has_contracts": {
                "date_histogram": {
                    "field": "description.date",
                    "calendar_interval": "year",
                    "format": "yyyy" ,
                    "min_doc_count": 1
                }
            }
        }

        return agg;
    }

    async calculateResult(parameters,result) {
        // Acá lo que hay que evaluar es si la party está en el dataset
        //TODO: Make flag fail for suppliers also

        parameters.agg.year_has_contracts.buckets.map(year => {
            //Si es un supplier con dos id que viene del dataset preprocesado
            if (this.additionalData.preprocessed.hasOwnProperty(parameters.party)) {

                //Check for exceeded buyers
                if (this.additionalData.preprocessed[parameters.party].years.hasOwnProperty(year.key_as_string)) {
                    result.fail_year(year.key_as_string);

                    //Check for exceeded suppliers
                    //Invertir el árbol acá o en preprocessed o en getpreprocessed?
                    if (this.additionalData.preprocessed[parameters.party].years[year.key_as_string].hasOwnProperty()) {
                        result.fail_year(year.key_as_string);
                    }
                }
            }
            else result.pass_year(year.key_as_string);
        });
        return result;
    }
}

module.exports = { OneFewBiddersWinDisproportionateNumberContractsSameTypePartyEvaluationModule }
