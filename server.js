const express = require('express');
const app = express();
const mongo = require('mongodb').MongoClient;
const shortMongoId = require('short-mongo-id');

const db_url = 'mongodb://localhost:27017/database';

console.log("environment = " + app.get('env'));

app.set('port', process.env.PORT || 8080);

app.get('/new/*', function(req, res, next) {
    const url = req.params[0];
    const validUrl = require('valid-url');
    if(!validUrl.isWebUri(url))
        return next('invalid url');
        
    function buildResponse(fullUrl, shortId) {
        return {
            full_url: fullUrl,
            short_url: 'http://' + req.headers.host + '/' + shortId
        }
    }

    mongo.connect(db_url, function(err, db) {
        if(err)
            return next(err);
        
        const urls = db.collection('urls');
        urls.findOne({
            url: url
        }, function(err, doc) {
            if(err)
                return next(err);
            
            if(!doc) {
                // not found, create
                urls.insertOne({
                    url: url
                }, function(err, r) {
                    if(err)
                        return next(err);
                    
                    // create short id for the newly created document
                    // and insert the short id in the document
                    const insertedId = r.ops[0]._id;
                    const shortId = shortMongoId(insertedId);
                    urls.update({
                        _id: insertedId
                    }, {
                        $set: {
                            shortId: shortId   
                        }
                    },function(err, r) {
                        if(err) return next(err);
                        
                        // send response with short url
                        res.json(buildResponse(url, shortId));
                    });
                })
            } else {
                // already shortened url, return
                res.json(buildResponse(doc.url, doc.shortId));
            }
        });
    });
});

app.get('/:shortUrl', function(req, res, next) {
    mongo.connect(db_url, function(err, db) {
        if(err) return next(err);
        
        const urls = db.collection('urls');
        urls.findOne({
            shortId: req.params.shortUrl
        }, function(err, doc) {
            if(err) return next(err);
            
            if(doc) {
                res.redirect(doc.url);
            } else {
                res.end('invalid short url');
            }
        });
        
    });
});

app.listen(app.get('port'), function() {
    console.log('Server ready!');
})