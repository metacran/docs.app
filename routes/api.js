var express = require('express');
var router = express.Router();
var amqp = require('amqplib');
var when = require('when');
var request = require('request');

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

	amqp.connect(broker_url).then(function(conn) {
	    return when(conn.createChannel().then(function(ch) {
		var ok = ch.assertQueue(q, { durable: true })
		    .then(function() { return 0; });

		for (p in docs) {
		    ok = ok.then(function(p) {
			var package = docs[p];
			var entry = { 'package': package,
				      'added_at': new Date().toISOString(),
				      'added_by': 'docs.app/rebuild-existing' };
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
	    .send({ 'operation': 'rebuild-existing',
		    'type': 'readme',
		    'result': 'OK' })
	    .end();
    })
})

module.exports = router;
