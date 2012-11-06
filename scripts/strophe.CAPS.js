Strophe.addConnectionPlugin('caps', (function() {
	// public properties
	var addFeature, createCapsNode, generateVerificationString, init, removeFeature, sendPres;
	// local properties
	var _connection, propertySort;

	init = function(connection) {
		_connection = connection;
		Strophe.addNamespace('CAPS', "http://jabber.org/protocol/caps");
		
		if (_connection.disco === void 0)
			throw new Error("disco plugin required!");
		if (b64_sha1 === void 0)
			throw new Error("SHA-1 library required!");
			
		_connection.disco.addFeature(Strophe.NS.CAPS);
		_connection.disco.addFeature(Strophe.NS.DISCO_INFO);
		if (_connection.disco.hasIdentities) {
			return _connection.disco.addIdentity("client", "pc", "XpressiveJS 0.1", "");
		}
	};

	addFeature = function(feature) {
		return _connection.disco.addFeature(feature);
	};

	removeFeature = function(feature) {
		return _connection.disco.removeFeature(feature);
	};

	sendPres = function() {
		return _connection.send($pres().cnode(createCapsNode().tree()));
	};

	createCapsNode = function() {
		var node;
		if (_connection.disco.hasIdentities) {
			node = _connection.disco.getIdentity(0).name || "";
		} else {
			node = dummyId.name;
		}
		return $build("c", {
			xmlns : Strophe.NS.CAPS,
			hash : "sha-1",
			node : node,
			ver : generateVerificationString()
		});
	};

	propertySort = function(array, property) {
		return array.sort(function(a, b) {
			if (a[property] > b[property]) {
				return -1;
			} else {
				return 1;
			}
		});
	};

	generateVerificationString = function() {
		var S, features, i, id, ids, k, key, ns, _i, _j, _k, _len, _len2, _len3, _ref, _ref2;
		ids = [];
		_ref = _connection.disco.identities;
		for ( _i = 0, _len = _ref.length; _i < _len; _i++) {
			i = _ref[_i];
			ids.push(i);
		}
		features = [];
		_ref2 = _connection.disco.features;
		for ( _j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
			k = _ref2[_j];
			features.push(k);
		}
		S = "";
		propertySort(ids, "category");
		propertySort(ids, "type");
		propertySort(ids, "lang");
		for (key in ids) {
			id = ids[key];
			S += "" + id.category + "/" + id.type + "/" + id.lang + "/" + id.name + "<";
		}
		features.sort();
		for ( _k = 0, _len3 = features.length; _k < _len3; _k++) {
			ns = features[_k];
			S += "" + ns + "<";
		}
		return "" + (b64_sha1(S)) + "=";
	};

	return {
		init : init,
		removeFeature : removeFeature,
		addFeature : addFeature,
		sendPres : sendPres,
		generateVerificationString : generateVerificationString,
		createCapsNode : createCapsNode
	};
})());
