var mongoose = require('mongoose');
var url = 'mongodb://localhost/kf6-dev';
mongoose.connect(url, {
    options: {
        db: {
            safe: true
        }
    }
});

var Schema = mongoose.Schema;

var CommunitySchema = new Schema({
    title: String
}, {
    strict: false
});
var Community = mongoose.model('Community', CommunitySchema);

var FreeSchema = new Schema({}, {
    strict: false
});
var User = mongoose.model('User', FreeSchema);
var Contribution = mongoose.model('Contribution', FreeSchema);
var Link = mongoose.model('Link', FreeSchema);
var Record = mongoose.model('Record', FreeSchema);


var fs = require('fs');
var readline = require('readline');
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

Community.find(function(err, communities) {
    var i = 0;
    communities.forEach(function(each) {
        console.log('[' + i + ']' + each.title + ' :' + each._id);
        i++;
    });
    rl.question("number?", function(answer) {
        rl.close();
        var community = communities[answer]
        var data = {};
        data.community = community;
        x(data);
    });
});

function x(data) {
    User.find(function(err, authors) {
        data.authors = authors;
        y(data);
    });
}

function y(data) {
    Contribution.find({
        communityId: data.community._id
    }, function(err, contributions) {
        data.contributions = contributions;
        z(data);
    });
}

function z(data) {
    Link.find(function(err, links) {
        data.links = links;
        xx(data);
    });
}

function xx(data) {
    Record.find({
        communityId: data.communityId
    }, function(err, records) {
        data.records = records;
        finish(data);
    });
}

function finish(data) {
    fs.writeFile('data.json', JSON.stringify(data), function(err) {
        if (err) {
            throw err;
        }
        console.log('It\'s saved!');
        process.exit();
    });
}