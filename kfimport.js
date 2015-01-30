var fs = require('fs');
var fsx = require('fs-extra');

if (process.argv.length !== 4) {
    console.log('argument number must be 4.');
    console.log('Usage: node import.js [dbname](kf6-dev/kf6) [foldername]');
    finish();
}

var dbName = process.argv[2];
var folderName = process.argv[3];
if (!fs.existsSync(folderName)) {
    console.log('folder ' + folderName + ' not found.');
    finish();
}
var jsonfile = folderName + '/data.json';

if (!fs.existsSync(jsonfile)) {
    console.log('data.json not found in the folder ' + folderName);
    finish();
}

var mongoose = require('mongoose');
var url = 'mongodb://localhost/'+ dbName;
mongoose.connect(url, {
    options: {
        db: {
            safe: true
        }
    }
});

var Schema = mongoose.Schema;

var CommunitySchema = new Schema({
    title: String,
    created: {
        type: Date,
        default: Date.now
    },
    scaffolds: [Schema.ObjectId],
    views: [Schema.ObjectId]
}, {
    strict: false
});
var Community = mongoose.model('Community', CommunitySchema);

var FreeSchema = new Schema({
    url: String,
    body: String,
    text4search: String
}, {
    strict: false
});
var User = mongoose.model('User', FreeSchema);
var Contribution = mongoose.model('Contribution', FreeSchema);
var Link = mongoose.model('Link', FreeSchema);
var Record = mongoose.model('Record', FreeSchema);
var Registration = mongoose.model('Registration', FreeSchema);

fs.readFile(jsonfile, 'utf8', function(err, text) {
    var data = JSON.parse(text);
    var idtable = {};
    pCommunity(data, idtable);
});

var len = 0;
var numFinished = 0;

function pCommunity(data, idtable) {
    var orgCommunity = {}
    orgCommunity.title = data.community.title;
    orgCommunity.registrationKey = data.community.registrationKey;
    Community.create(orgCommunity, function(err, community) {
        if (err) {
            console.log(err);
        }
        idtable.community = community;
        idtable.communityId = community._id;
        pAuthor(data, idtable);
    });
}

function pAuthor(data, idtable) {
    data.authors.forEach(function(author) {
        author.oldId = author._id;
        delete author._id;
    });
    len = data.authors.length;
    numFinished = 0;
    console.log('author: ' + len);
    data.authors.forEach(function(author) {
        User.findById(author.oldId, function(err, dbAuthor) {
            if (dbAuthor) {
                idtable[author.oldId] = dbAuthor._id
                pAddRegistration(data, idtable, dbAuthor);
            } else {
                User.create(author, function(err, dbAuthor) {
                    idtable[author.oldId] = dbAuthor._id
                    pAddRegistration(data, idtable, dbAuthor);
                });
            }
        });
    });
}

function pAddRegistration(data, idtable, author) {
    var registration = {};
    registration.communityId = idtable.communityId;
    registration.authorId = author._id;
    registration.role = 'writer';
    Registration.create(registration, function(err) {
        if (err) {
            console.log(err);
        }
        numFinished++;
        console.log('author=' + numFinished + '/' + len);
        if (numFinished >= len) {
            pContributions(data, idtable);
        }
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

        idtable.newNotes = [];
        newContributions.forEach(function(each) {
            if (each.type === 'Attachment') {
                pAttachment(idtable.communityId, each);
            }
            if (each.type === 'Note') {
                idtable.newNotes.push(each);
            }
        });

        var dataCommunity = data.community;
        var dbCommunity = idtable.community;
        var newScaffolds = [];
        dataCommunity.scaffolds.forEach(function(each) {
            newScaffolds.push(idtable[each]);
        });
        dbCommunity.scaffolds = newScaffolds;
        var newViews = [];
        dataCommunity.views.forEach(function(each) {
            newViews.push(idtable[each]);
        });
        dbCommunity.views = newViews;
        dbCommunity.save(function(err) {
            if (err) {
                console.log(err);
            }
        });

        pLinks(data, idtable);
    });
}

function pAttachment(communityId, contribution) {
    var path = folderName + '/attachments/' + contribution.oldId;
    var exists = fs.existsSync(path)
    if (exists) {
        var newPath = 'uploads/' + communityId + '/' + contribution._id + '/1/' + contribution.originalName;
        try {
            fsx.copySync(path, newPath);
        } catch (error) {
            console.log(error);
        }
        Contribution.findById(contribution._id, function(err, c) {
            c.url = '/' + newPath;
            c.save(function(err, x) {
                if (err) {
                    console.log(err);
                }
            });
        });
    }
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
        link.oldId = link._id;
        delete link._id;
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
    Link.collection.insert(links, {}, function(err, newLinks) {
        if (err) {
            console.log(err);
        }

        //post process
        newLinks.forEach(function(each) {
            idtable[each.oldId] = each._id;
        });

        pNotePostProcess(data, idtable);
    });
}

function pNotePostProcess(data, idtable) {
    var notes = idtable.newNotes;
    var len = notes.length;
    var numFinished = 0;
    notes.forEach(function(note) {
        Contribution.findById(note._id, function(err, dbNote) {
            var text = dbNote.body;
            var matched = text.match(/id="([0-9]+)"/g);
            if (matched) {
                matched.forEach(function(part) {
                    var id = part.match(/([0-9]+)/)[0];
                    var newId = idtable[id];
                    var newIdStr = 'id="' + newId + '"';                  
                    text = text.replace(part, newIdStr);
                });
            }
            dbNote.body = text;
            dbNote.text4search = dbNote.body;
            dbNote.save(function(err) {
                numFinished++;
                console.log('notepost ' + numFinished + '/' + len);
                if (numFinished >= len) {
                    pRecords(data, idtable);
                }
            });
        });
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