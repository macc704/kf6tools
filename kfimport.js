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
fs.readFile('data.json', 'utf8', function(err, text) {
    var data = JSON.parse(text);
    var idtable = {};
    x(data, idtable);
});

function x(data, idtable) {
    var orgCommunity = data.community;
    delete orgCommunity._id;
    Community.create(orgCommunity, function(err, community) {
        idtable.communityId = community._id;
        author(data, idtable);
    });
}

function author(data, idtable) {
    data.authors.forEach(function(author) {
        author.oldId = author._id;
        delete author._id;
    });
    var len = data.authors.length;
    var numFinished = 0;
    console.log('author: ' + len);
    data.authors.forEach(function(author) {
        User.findById(author.oldId, function(err, dbAuthor) {
            if (dbAuthor) {
                idtable[author.oldId] = dbAuthor._id
                numFinished++;
                console.log('author=' + numFinished + '/' + len);
                if (numFinished >= len) {
                    pContributions(data, idtable);
                }
            } else {
                User.create(author, function(err, dbAuthor) {
                    idtable[author.oldId] = dbAuthor._id
                    numFinished++;
                    console.log('author=' + numFinished + '/' + len);
                    if (numFinished >= len) {
                        pContributions(data, idtable);
                    }
                });
            }
        });
    });
}

function pContributions(data, idtable) {
    data.contributions.forEach(function(contribution) {
        contribution.oldId = contribution._id;
        delete contribution._id;
        contribution.communityId = idtable.communityId;
        var newAuthors = [];
        contribution.authors.forEach(function(authorId) {
            newAuthors.push(idtable[authorId]);
        });
        contribution.authors = newAuthors;
        contribution.__t = contribution.type;
    });

    var len = data.contributions.length;
    console.log('contribution: ' + len);
    Contribution.collection.insert(data.contributions, {}, function(err, inserted) {
        if (err) {
            console.log(err);
        }
        //var ilen = inserteds.length;
        for (var i = 0; i < len; i++) {
            idtable[data.contributions[i].oldId] = inserted[i]._id;
        }
        pLinks(data, idtable);
    });
    // var numFinished = 0;
    // var numOrdered = 0;
    // data.contributions.forEach(function(contribution) {
    //     Contribution.create(contribution, function(err, newContribution) {
    //         idtable[contribution.oldId] = newContribution._id;
    //         numFinished++;
    //         console.log('contribution=' + numFinished + '/' + len);
    //         if (numFinished >= len) {
    //             z(data, idtable);
    //         }
    //     });
    //     numOrdered++;
    //     console.log('contribution order=' + numOrdered + '/' + len);
    // });
    // if (len <= 0) {
    //     console.log('len == 0 in y');
    //     finish();
    // }

    // stack overflow
    // Contribution.create(data.contributions, function(err) {
    //     if (err) {
    //         console.log(err);
    //         return;
    //     }
    //     z(data, idtable);
    // });
}

function pLinks(data, idtable) {
    var links = [];
    data.links.forEach(function(link) {
        var newFrom = idtable[link.from];
        var newTo = idtable[link.to];
        if (!newFrom || !newTo) {
            //console.log('not found!');
            return;
        }
        //console.log('found!');        
        link.communityId = idtable.communityId;
        link.from = newFrom;
        link.to = newTo;
        link._id = null;
        links.push(link);
    });

    var len = links.length;
    console.log('links: ' + len);
    var numOrdered = 0;
    var numFinished = 0;
    links.forEach(function(link) {
        Link.create(link, function() {
            numFinished++;
            console.log('links' + numFinished + '/' + len);
            if (numFinished >= len) {
                xx(data, idtable);
            }
        });
        numOrdered++;
        console.log('links ordered' + numOrdered + '/' + len);
    });
    if (len <= 0) {
        console.log('len == 0 in z');
        console.log(idtable);
        finish();
    }
}

function xx(data, idtable) {
    data.records.forEach(function(record) {
        delete record._id;
        record.communityId = idtable.communityId;
        record.targetId = idtable[record.targetId];
        record.authorId = idtable[record.authorId];
    });

    var len = data.records.length;
    console.log('records: ' + len);
    // var numOrdered = 0;
    // var numFinished = 0;
    // var handler = function(err, newRecord) {
    //     numFinished++;
    //     console.log('record=' + numFinished + '/' + len);
    //     if (numFinished >= len) {
    //         finish();
    //     }
    // };
    // data.records.forEach(function(record) {
    //     Record.create(record, handler);
    //     numOrdered++;
    //     console.log('record order=' + numOrdered + '/' + len);
    // });
    Record.collection.insert(data.records, {}, function(err) {
        if (err) {
            console.log(err);
        }
        finish();
    });
    // StackoverFlow
    // Record.create(data.records, function(err, newRecords) {
    //     if(err){
    //         console.log(err);
    //     }
    //     finish();
    // });
    if (len <= 0) {
        console.log('len == 0 in xx');
        finish();
    }
}

function finish() {
    process.exit();
}