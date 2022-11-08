const { EvaluationModule } = require("../../lib/lib");
const removeDiacritics = require('diacritics').remove;

class UnderstandingTitleEvaluationModule extends EvaluationModule {
    static moduleName = "understanding-title";
    static params = [
        { name: "values", type: "queryArray" }
    ];

    constructor() {
        super()
    }

    calculateResult(parameters, result) {
        let titles = parameters.values;
        result.pass();

        // console.log("calculateResult",titles,titles.length);
        // process.exit();
        if(titles.length > 0) {
            titles.map( title => {
                if(Object.prototype.toString.call(title) === '[object Array]') title = title[0]; // Sometimes values are passed as an array of arrays, sometimes plain strings
                if( title && !this.checkComprensibility(title) ) result.fail();
            } )
        }
        else result.fail(); // Flag is raised when there are no titles in the whole document.

        return result;
    }
    checkComprensibility(string) {
        const comunes = [
            'a', 'ante', 'bajo', 'cabe', 'con', 'contra', 'de', 'desde', 'en', 'entre', 'hacia', 'hasta', 'para', 'por', 'segun', 'sin', 'sobre', 'tras',
            'la', 'las', 'el', 'los', 'del', 'que', 'mediante', 'su', 'sus', 'asi'
        ];
        const diccionario = [
            "abarrote","\\babarr","accesorio","actividad","adjudicaci.?n","administraci.?n","adquisici.?n","\\bapoyo\\b","\\barea\\b","arrendamiento",
                "articulo","asesor.?a","atenci.?n","avenida",
            "\\bbase\\b","bienes","blockchain",
            "\\bcabo\\b","\\bcalle\\b","camino","\\bcampo\\b","capacitaci.?n","carretera","\\bcat\\b","\\bcentr(al|o)\\b","ceremonia","ciudad","\\bclase\\b","coadyuvar","codigo","color",
                "comestible","compra","conservaci.?n","construcci.?n","consumible","consultoria","contrataci.?n","contrato","control","curso",
            "delegaci.?n","desarrollo","diferente","direct(a|o)","distribuci.?n","divers(a|o)","durante","\\bdos\\b",
            "edificio","ejecucion","ejercicio","elaboraci.?n","equipo","estado","especialidad","estructura","estudio","\\betapa\\b","evento",
            "farmacia","farmaceutic","federal",
            "\\bgasto\\b","general","\\bgrupo",
            "\\bherr\\b","herramienta","hospital",
            "impartir","informaci.?n","inmueble","instalaci.?n","institu(to|ci.?n)","insumo","integral","invitaci.?n",
            "laboratorio","licencia","licitaci.?n","localidad",
            "\\bmant(to)?\\b","mantenimiento","maquinaria","\\bmarca\\b","material?","medicamento","m.?dic(a|o)","medicina","\\bmedios\\b","mercancia",
                "m.?xico","mobiliario","modelo","municipio",
            "nacional","necesidad","\\bnuev(a|o)\\b",
            "\\bobras?\\b","oficina","operaci.?n","\\botros?\\b",
            "papel","parque","partida","pedido","personal","plaza","prestaci.?n","prestador","producci.?n","producto","profesional","programa","proyecto","p.?blica",
            "realiza","reconstrucci.'n","recurso","\\bred\\b","refacci.?n","regional","rehabilitaci.?n","reparaci.?n","restringida","reuni.?n","\\bropa\\b",
            "sector","seguimiento","servicio","sistema","soporte","subrogado","suministro","supervis","suscripci.?n","sustancia",
            "taller","tercero","traslado","tecnic","\\btipo\\b","trabajo","\\btramo\\b","transporte",
            "ubicado","unidad","\\buso\\b","utiles",
            "\\bzona\\b"
        ];
        const dict_regex = new RegExp(diccionario.join("|"), "i");

        var comprensible = false;

        if(!string || typeof string == 'number') { return; }

        var cleanValues = removeDiacritics(string).toLowerCase(); // quitar acentos y diéresis, pasar a minúsculas
        var words = cleanValues.split(' ');
        // console.log('Words found:', words);

        var regexes = [];
        regexes.push("\\d");                // todos los números y códigos
        regexes.push("(\\W.*){3,}");        // cadena de texto con tres caracteres o más no alfanuméricos
        var re = new RegExp(regexes.join("|"), "i");
        var wordsLeft = words.filter( (word) => !re.test(word) );

        if(wordsLeft.length > 0) {
            let cleanWords = [];
            // Dejar sólo alfabéticos reemplazando los otros caracteres con “ ”
            wordsLeft.map( (word) => {
                let cleanWord = word.replace(/\W/, ' ');
                cleanWords.push( ...cleanWord.split(' ') );
            } );

            // cualquier palabra que tenga dos letras o menos, artículos y preposiciones
            wordsLeft = cleanWords.filter( (word) => {
                return word.length > 2 && comunes.indexOf(word) == -1;
            } );

            if(wordsLeft.length > 0) {
                // cualquier palabra que esté en el diccionario de palabras irrelevantes para comprensibilidad del título
                if(wordsLeft.length > 0) {
                    wordsLeft = wordsLeft.filter( (word) => !dict_regex.test(word) );
                    if(wordsLeft.length > 0) {
                        comprensible = true;
                    }
                }
            }
        }

        return comprensible;
    }




}


module.exports = {UnderstandingTitleEvaluationModule}
