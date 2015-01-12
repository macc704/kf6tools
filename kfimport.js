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

var FreeSchema = new Schema({
    url: String
}, {
    strict: false
});
var User = mongoose.model('User', FreeSchema);
var Contribution = mongoose.model('Contribution', FreeSchema);
var Link = mongoose.model('Link', FreeSchema);
var Record = mongoose.model('Record', FreeSchema);

var fs = require('fs');
var fsx = require('fs-extra');

if (process.argv.length !== 3) {
    console.log('argument number must be 3.');
    finish();
}

var db = process.argv[2];
if (!fs.existsSync(db)) {
    console.log('folder ' + db + ' not found.');
    finish();
}
var jsonfile = db + '/data.json';

if (!fs.existsSync(jsonfile)) {
    console.log('data.json not found in the folder ' + db);
    finish();
}

fs.readFile(jsonfile, 'utf8', function(err, text) {
    var data = JSON.parse(text);
    var idtable = {};
    pCommunity(data, idtable);
});

function pCommunity(data, idtable) {
    var orgCommunity = data.community;
    delete orgCommunity._id;
    Community.create(orgCommunity, function(err, community) {
        idtable.communityId = community._id;
        pAuthor(data, idtable);
    });
}

function pAuthor(data, idtable) {
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
    Contribution.collection.insert(data.contributions, {}, function(err, newContributions) {
        if (err) {
            console.log(err);
        }

        //post process
        newContributions.forEach(function(each) {
            idtable[each.oldId] = each._id;
        });

        newContributions.forEach(function(each) {
            if (each.type === 'Attachment') {
                pAttachment(idtable.communityId, each);
            }
        });

        pLinks(data, idtable);
    });
}

function pAttachment(communityId, contribution) {
    var path = db + '/attachments/' + contribution.oldId;
    fs.exists(path, function(exists) {
        if (exists) {
            var newPath = 'uploads/' + communityId + '/' + contribution._id + '/1/' + contribution.originalName;
            fsx.copySync(path, newPath);
            Contribution.findById(contribution._id, function(err, c) {
                c.url = '/' + newPath;
                c.save(function(err, x) {
                    if (err) {
                        console.log(err);
                    }
                });
            });
        }
    });
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

        if (link.data) {
            delete link.data.width;
            delete link.data.height;
        }
    });

    var len = links.length;
    console.log('links: ' + len);
    Link.collection.insert(links, {}, function(err) {
        if (err) {
            console.log(err);
        }
        pRecords(data, idtable);
    });
}

function pRecords(data, idtable) {
    data.records.forEach(function(record) {
        delete record._id;
        record.communityId = idtable.communityId;
        record.targetId = idtable[record.targetId];
        record.authorId = idtable[record.authorId];
    });

    var len = data.records.length;
    console.log('records: ' + len);
    Record.collection.insert(data.records, {}, function(err) {
        if (err) {
            console.log(err);
        }
        finish(idtable);
    });
}

function finish(idtable) {
    if (idtable) {
        console.log("finished " + idtable.communityId);
    }
    process.exit();
}