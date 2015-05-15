var express = require('express');
var router = express.Router();

var broker_url = process.env.RABBITMQ_URL || 'amqp://localhost';

var re_full = new RegExp('^/build/readme/([\\w\\.]+)$');
router.get(re_full, function(req, res) {
    var package = req.params[0];
    var q = 'readme';
    var open = require('amqplib').connect(broker_url);

    open.then(function(conn) {
	var ok = conn.createChannel();
	ok = ok.then(function(ch) {
	    ch.assertQueue(q);

	    var entry = { 'package': package,
			  'added_at': new Date().toISOString(),
			  'added_by': 'docs.app' };

	    ch.sendToQueue(q, new Buffer(JSON.stringify(entry)));
	});
	return ok;
    }).then(null, console.warn);

    res.set('Content-Type', 'application/json')
	.send({ 'operation': 'add',
		'type': 'readme',
		'package': package,
		'result': 'OK' })
	.end();
})

module.exports = router;
