var express = require('express');
var router = express.Router();
var amqp = require('amqplib');
var when = require('when');

var broker_url = process.env.RABBITMQ_URL || 'amqp://localhost';

var re_full = new RegExp('^/build/readme/([\\w\\.]+)$');
router.get(re_full, function(req, res) {
    var package = req.params[0];
    var q = 'readme';

    amqp.connect(broker_url).then(function(conn) {
	return when(conn.createChannel().then(function(ch) {
	    var ok = ch.assertQueue(q, { durable: true });

	    var entry = { 'package': package,
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
		'type': 'readme',
		'package': package,
		'result': 'OK' })
	.end();
})

module.exports = router;
