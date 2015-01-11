var mongoose = require('mongoose');
var fs = require('fs');

var url = 'mongodb://localhost/kf6-kfimport';

mongoose.connect(url, {
    options: {
        db: {
            safe: true
        }
    }
});

var Schema = mongoose.Schema;

var TestSchema = new Schema({
    title: String
}, {
    strict: false
});

var Test = mongoose.model('Test', TestSchema);
Test.create({
    title: 'hoge',
    title2: 'hoge3'
});

fs.readFile('./Susana-test/tuples.txt', 'utf8', function(err, text) {
    //    console.log(text);
    //    console.log('error!?');
    //    console.log(err);
    var lines = text.toString().split('\n');
    var len = lines.length;
    var notes = [];
    for (var i = 0; i < len; i++) {
        var line = lines[i];
        var index = line.indexOf('{')
        var num = line.substr(0, index).trim();
        //console.log(num);
        var id = Number(num);
        var objectStr = line.substr(index + 1);
        var object = oneObj(id, objectStr);
        if (object) {
            if (object.Object === 'note') {
                notes.push(object);
            }
        }
    }
    var noteCount = notes.length;
    var processed = [];
    notes.forEach(function(note) {
        Test.create({
            title: note.titl,
            body: note.text,
            created: note.crea,
        }, function(err, obj) {
            processed.push(obj);
            if (processed.length === noteCount) {
                x(processed);
            }
        });
    });
});


function x(processed) {
//    console.log('finished');
    processed.forEach(function(each){
        console.log(each);
    });
}

function oneObj(id, object) {
    var vars = object.split(';');
    var len = vars.length - 1; //the last is }
    if (len <= 0) {
        return null;
    }
    var object = {
        id: id
    };
    for (var i = 0; i < len; i++) {
        var avar = vars[i];
        var index = avar.indexOf('=');
        var key = avar.substr(0, index).trim();
        var value = avar.substr(index + 1).trim();
        var vlen = value.length;
        //console.log(value.charAt(0), value.charAt(vlen-1));
        if (vlen >= 2 && value.charAt(0) === '"' && value.charAt(vlen - 1) === '"') {
            value = value.substr(1, vlen - 2);
        }
        var pattern = /date\((.*)\)/; //()で囲むと保存できる
        var date = value.match(pattern);
        if (date) {
            var datelong = Number(date[1]) * 1000;
            value = new Date(datelong);
        } else {


            var idPattern = /ID\((.*)\)/; //()で囲むと保存できる
            var idx = value.match(idPattern);
            if (idx) {
                value = Number(idx[1]);
            }
        }
        //        var dateIdx = value.indexOf('date(');
        //        if (dateIdx === 0){
        //        }
        object[key] = value;
    }
    return object;
}


//process.exit();