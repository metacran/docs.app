var express = require('express');
var router = express.Router();
var amqp = require('amqplib');
var when = require('when');
var request = require('request');

var crandb = 'http://crandb.r-pkg.org';

var broker_url = process.env.RABBITMQ_URL || 'amqp://localhost';

var re_full1 = new RegExp('^/build/readme/([\\w\\.]+)$');
router.get(re_full1, function(req, res) {
    var package = req.params[0];
    queue_this('readme', package, res);
})

var re_full2 = new RegExp('^/build/news/([\\w\\.]+)$');
router.get(re_full2, function(req, res) {
    var package = req.params[0];
    queue_this('news', package, res);
})

var re_full3 = new RegExp('^/build/task-view/(.*)$');
router.get(re_full3, function(req, res) {
    var tv = req.params[0];
    console.log(tv)
    queue_this('task-view', tv, res);
})

router.get('/build/news/all-packages', function(req, res) {
    var url = crandb + '/-/desc';
    request(url, function(error, response, body) {
	if (error || response.statusCode != 200) {
	    return console.log("Cannot connect to CRANDB");
	}
	var pkgs = Object.keys(JSON.parse(body));
	queue_these('news', pkgs, res, "all-packages");
    })
})

function queue_this(type, item, res) {
    var q = type;

    amqp.connect(broker_url).then(function(conn) {
	return when(conn.createChannel().then(function(ch) {
	    var ok = ch.assertQueue(q, { durable: true });

	    var entry = { 'package': item,
			  'added_at': new Date().toISOString(),
			  'added_by': 'docs.app' };

	    return ok.then(function() {
		var msg = JSON.stringify(entry);
		ch.sendToQueue(q, new Buffer(msg), { deliveryMode: true });
		return ch.close();
	    });
	})).ensure(function() { conn.close(); });
    }).then(null, console.warn);

    res.set('Content-Type', 'application/json')
	.send({ 'operation': 'add',
		'type': type,
		'package': item,
		'result': 'OK' })
	.end();
}

// Rebuild all existing READMEs

router.get('/build/readme/rebuild-existing', function(req, res) {
    var couch_url = process.env.DOCSDB_URL || 'http://127.0.0.1:5984';
    var url = couch_url + '/readme/_all_docs';
    var q = 'readme';
    request(url, function(error, response, body) {
	if (error || response.statusCode != 200) {
	    res.set('Content-Type', 'application/json')
		.set(500)
		.send({ "result": "error",
			"error": error })
		.end();
	}
	var docs = JSON.parse(body)
	    .rows
	    .map(function(x) { return x["id"]; });

	queue_these('readme', docs, res, 'build-existing')
    })
})

router.get('/build/readme/all-packages', function(req, res) {
    var url = crandb + '/-/desc';
    request(url, function(error, response, body) {
	if (error || response.statusCode != 200) {
	    return console.log("Cannot connect to CRANDB");
	}
	var pkgs = Object.keys(JSON.parse(body));
	queue_these('readme', pkgs, res, "all-packages");
    })
})

function queue_these(type, pkgs, res, operation) {
    var q = type;

    amqp.connect(broker_url).then(function(conn) {
	return when(conn.createChannel().then(function(ch) {
	    var ok = ch.assertQueue(q, { durable: true })
		.then(function() { return 0; });

	    for (p in pkgs) {
		ok = ok.then(function(p) {
		    var package = pkgs[p];
		    var entry = { 'package': package,
				  'added_at': new Date().toISOString(),
				  'added_by': 'docs.app/all-packages' };
		    var msg = JSON.stringify(entry);
		    console.log(entry);
		    ch.sendToQueue(q, new Buffer(msg),
				   { deliveryMose: true });
		    return p + 1;
		});
	    }

	    return ok.then(function() { return ch.close(); });
	})).ensure(function() { conn.close(); });
    }).then(null, console.warn);

    res.set('Content-Type', 'application/json')
	.send({ 'operation': operation,
		'type': type,
		'result': 'OK' })
	.end();
}

module.exports = router;
