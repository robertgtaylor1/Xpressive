var Xpressive = {
	connection : null,
	start_time : null,
	pending_subscriber : null,

	jid_to_id : function(jid) {
		return Strophe.getBareJidFromJid(jid).replace("@", "-").replace(/\./g, '-');
	},

	occupantJid_to_id : function(jid) {
		return jid.replace("@", "-").replace("/", "-").replace(/\./g, '-');
	},

	log : function(msg) {
		$('#console .log-messages').append("<div><span class='log'>" + msg + "</span></div>");
	},

	do_presence_changed : function(contact) {
		if (contact === undefined){
			return true;
		}
		
		var show = "online";
		var jid_id = Xpressive.jid_to_id(contact.jid);

		Xpressive.log("Got presence from: " + contact.jid);
		var contactElem = $('#roster-area li#' + jid_id + ' div.roster-contact');

		if (contactElem) {
			contactElem.removeClass("online").removeClass("away").removeClass("chat").removeClass("xa").removeClass("dnd").removeClass("offline");
			if (contact.online()) {
				for( resource in contact.resources) {
					show = contact.resources[resource].show || "online";
					break;
				}
			} else {
				show = "offline";
			}
			contactElem.addClass(show);

			// reset addressing for user since their presence changed
			//$('#chat-' + jid_id).data('jid', Strophe.getBareJidFromJid(from));
		}
		return true;
	},

	do_ask_subscription : function(jid) {
		$('#approve_dialog').dialog('option', 'jid', jid);
		$('#approve_dialog').dialog('open');
	},
	
	do_rooms_changed : function(server) {
		Xpressive.log("Got rooms update:");
		
		for(var attr in server.rooms){
			Xpressive.do_room_changed(server.rooms[attr]);
		}
	},
	
	do_room_changed: function(room){
		var room_id = Xpressive.jid_to_id(room.roomJid);
		var room_html = "<li id='" + room_id + "'>" + 
							"<div class='room-entry'>" + 
								"<div class='room-name'><span style='display:inline-block;'>" + room.roomName + "</span>";
		
		var numberOfOccupants = room.numberOfOccupants();
		if  (numberOfOccupants > 0) {
			room_html += "&nbsp;<img class='ui-icon ui-icon-person xmpp-occupantCount' style='display:inline-block; vertical-align:bottom;'/>" +
							"<div class='tooltip'>Number of occupants</div>" + 
							"<span style='font-size:75%; vertical-align:center;'>("+ numberOfOccupants +")</span>";
		}
					
		if (room.requiresPassword()) {
			room_html += "&nbsp;<img class='ui-icon ui-icon-key xmpp-protected' style='display:inline-block; vertical-align:bottom;'/>" +
							"<div class='tooltip'>Password required</div>";
		}
		
		if (room.isModerator()){
			room_html += "&nbsp;<img class='ui-icon ui-icon-person xmpp-moderator' style='display:inline-block; vertical-align:bottom;'/>" +
							"<div class='tooltip'>You are a moderator</div>";
		}
		
		room_html += "<img class='ui-icon ui-icon-refresh xmpp-refresh-room' style='display:inline-block; vertical-align:bottom;'/>" +
						"<div class='tooltip'>Click to refresh info</div>" +
					 "<img class='ui-icon ui-icon-play xmpp-join-room' style='display:inline-block; vertical-align:bottom;'/>" +
						"<div class='tooltip'>Click to join</div>";
		
		room_html += "</div>";
		//room_html += "<div class='room-description'>" + room.description();
		room_html += "<div class='room-jid'>" + room.roomJid + "</div>" +
							"</div>" + 
						"</li>";

		Xpressive.insert_room(room_id, room_html);
	},
	
	do_update_info : function(contact) {
		var jid = contact.jid;
		var jid_id = Xpressive.jid_to_id(jid);
		var contact_entry = '#' + jid_id;
		$(contact_entry + " #contact_info").text(contact.getInfo());
	},
	
	do_roster_changed : function(contactsList) {
		Xpressive.log("Got roster update:");

		for (var jid in contactsList) {
			var contact = contactsList[jid];
			var sub = contact.subscription;
			var jid = contact.jid;
			var name = contact.name || Strophe.getNodeFromJid(jid);
			var groups = contact.getGroups();
			var jid_id = Xpressive.jid_to_id(jid);

			Xpressive.log("    jid: " + jid + "[" + sub + "]");

			if (sub === 'remove') {
				// contact is being removed
				$('#' + jid_id).remove();
			} else {
				// contact is being added or modified
				var show = "online";
				if (contact.online()) {
					for( resource in contact.resources) {
						show = contact.resources[resource].show || "online";
						break;
					}
				} else {
					show = "offline";
				}
				var contact_entry = '#' + jid_id;
				var contact_html = "<li id='" + jid_id + "'>" + 
										"<div class='roster-contact " + show + "'>" + 
											"<div class='roster-name' style='display:inline-block;'>" + name + "</div>";

				contact_html += 	"&nbsp;<img class='ui-icon ui-icon-info xmpp-contact-info' " +
											"style='display:inline-block; vertical-align:bottom;'/>" +
										"<div id='contact_info' class='tooltip'>" + contact.getInfo() + "</div>";
				
				if (contact.subscription !== "both") {
					contact_html += 	"&nbsp;<img class='ui-icon ui-icon-lightbulb xmpp-change-details' " +
											"style='display:inline-block; vertical-align:bottom;'/>" +
										"<div class='tooltip'>Subscription pending.</div>";
				}											
				contact_html += 	"&nbsp;<img class='ui-icon ui-icon-pencil xmpp-change-details' " +
											"style='display:inline-block; vertical-align:bottom;'/>" +
										"<div class='tooltip'>Modify details.</div>" +
									"&nbsp;<img class='ui-icon ui-icon-close xmpp-remove-contact' " +
											"style='display:inline-block; vertical-align:bottom;'/>" +
										"<div class='tooltip'>Remove contact</div>" +
									"&nbsp;<img class='ui-icon ui-icon-play xmpp-chat-to' " +
											"style='display:inline-block; vertical-align:bottom;'/>" +
										"<div class='tooltip'>Start chat</div>" +
									"<div class='roster-jid'>" + jid + "</div>" +
									"<div class'roster-groups'>Groups: " + groups + "</div>" +
								"</div>" +
								"</li>";

				if ($(contact_entry).length > 0) {
					$(contact_entry).replaceWith(contact_html);
				} else {
					Xpressive.insert_contact(jid_id, contact_html);
				}
				//TODO $(contact_entry).data('jid', jid);
			}
		};

		return true;
	},

	on_start_chat : function(jid, name, groupChat) {

		var jid_id = Xpressive.jid_to_id(jid);
		var chatTab = '#chat-' + jid_id;

		if (!name) {
			name = Strophe.getNodeFromJid(jid);
		}
		var bareJid = Strophe.getBareJidFromJid(jid);
		var resource = Strophe.getResourceFromJid(jid);

		var chatArea = $('#chat-area ' + chatTab)[0];
		if (!chatArea) {
			$('#chat-area').tabs('add', chatTab, name);
			if (groupChat){
				$(chatTab).append("<span id='topic-label'>Topic : <input type='text' class='chat-topic' /></span>");
			}
			$(chatTab).append("<div class='chat-messages' ></div>" + "<input type='text' class='chat-input'/>");
			$(chatTab).data('jid', jid);
			$(chatTab).data('name', name);
			$(chatTab).data('resource', resource);
			if (groupChat){
				$(chatTab).data('groupChat', groupChat);				
			}
			$(chatTab + ' .chat-input').position({
				of: chatTab,
				my: 'left botton',
				at: 'left bottom',
				collision: 'none'
			});
		}
		$('#chat-area').tabs('select', chatTab);
		$(chatTab + ' input').focus();
		$('#client').trigger('resize');
	},

	on_join_room : function(jid, name) {	
		this.on_start_chat(Strophe.getBareJidFromJid(jid), name, true);
	},
	
	on_message : function(message, fromMe) {
		var jid, full_jid, jid_id, chatTab, name, resource, composing, body, span, messageSender; 
		var	groupChat = false;
		var messageTime = new Date();
		var delay;
		
		if (fromMe) {
			messageSender = Xpressive.connection.me.jid;
			jid = Strophe.getBareJidFromJid($(message).attr('to'));
			Xpressive.log("Sending message to: " + jid);
			name = "Me";
		} else {
			full_jid = $(message).attr('from');
			jid = Strophe.getBareJidFromJid(full_jid);
			Xpressive.log("Got message from: " + jid);
			messageSender = (groupChat ? full_jid : jid);
		}
		
		jid_id = Xpressive.jid_to_id(jid);
		chatTab = '#chat-' + jid_id;
		groupChat = $(chatTab).data('groupChat') || false;
		
		if (!fromMe) {
			if (groupChat){
				name = Strophe.getResourceFromJid($(message).attr('from'));
			} else {			
				resource = $(chatTab).data('resource');
				if (!resource) {
					$(chatTab).data('resource', Strophe.getResourceFromJid(full_jid));
				}			
				name = $(chatTab).data('name');
			}
		}
		delay = $(message).find('delay');
		if (delay.length === 0){
			delay = $(message).find('x');
		}
		if (delay.length !== 0){
			var stamp = delay.attr('stamp');
			messageTime = new Date(stamp);
		}
		
		topic = $(message).find('subject');
		if (topic.length > 0){
			topic = topic.text();
			$(chatTab + ' .chat-topic').val(topic);
		} else {
			
			if ($(chatTab).length === 0) {
				$('#chat-area').tabs('add', chatTab, Strophe.getNodeFromJid(jid));
				$(chatTab).append("<div class='chat-messages'></div>" + "<input type='text' class='chat-input'/>");
			}
	
			$('#chat-area').tabs('select', chatTab);
			$(chatTab + ' input').focus();
	
			composing = $(message).find('composing');
			if (composing.length > 0) {
				$(chatTab + ' .chat-messages').append("<div class='chat-event'>" + name + " is typing...</div>");
	
				Xpressive._scroll_chat(jid_id);
			}
			// TODO let's ignore HTML content for now
			body = ""; //$(message).find("html > body");
	
			if (body.length === 0) {
				body = $(message).find('body');
				if (body.length > 0) {
					body = body.text()
				} else {
					body = null;
				}
			} else {
				body = body.contents();
	
				span = $("<span></span>");
				body.each(function() {
					if (document.importNode) {
						$(document.importNode(this, true)).appendTo(span);
					} else {
						// IE workaround
						span.append(this.xml);
					}
				});
				body = span;
			}
	
			if (body) {
				// remove notifications since user is now active
				$(chatTab + ' .chat-event').remove();
	
				// add the new message
				var lastUl = $(chatTab + ' ul').last();
				var appendUl = true;
				
				if (lastUl.length > 0) {
					var lastUserId = $(chatTab + ' ul').last().data('sender');
					// if it's the same sender as the last message then don't repeat the name
					if (lastUserId === messageSender) {
						appendUl = false;
					}
				}
				var timeString = Xpressive._formatDate(messageTime, "{FullYear}-{Month:2}-{Date:2} {Hours:2}:{Minutes:2}");
				if (appendUl) {
					$(chatTab + ' .chat-messages').append("<ul class='chat-message" + ( fromMe ? " me'" : "'" ) + ">" + 
					                                    	"<span class='chat-message-group'><span class='chat-name'>" + name + "</span>:&nbsp;<span class='chat-time'>" + timeString + 
					                                    	"</span></span><span class='chat-text'></span></ul>");					
					lastUl = $(chatTab + ' ul').last().data('sender', messageSender);
				}
				$(chatTab + ' .chat-message:last .chat-text').append("<li>" + body + "<div class='chat-tooltip'>Message time : " + timeString + "</div></li>");
	
				Xpressive._scroll_chat(jid_id);
			}
		}
		return true;
	},

	_formatDate : function (d, // Date instance
    						f // Format string
						   ) {
    	return f.replace( // Replace all tokens
	        /{(.+?)(?::(.*?))?}/g, // {<part>:<padding>}
	        function (
	            v, // Matched string (ignored, used as local var)
	            c, // Date component name
	            p // Padding amount
	        ) {
	            for(v = d["get" + c]() // Execute date component getter
	                + /h/.test(c) // Increment Month components by 1
	                + ""; // Cast to String
	                v.length < p; // While padding needed, 
	                v = 0 + v); // pad with zeros
	            return v // Return padded result
	        })	
	},
	
	_scroll_chat : function(jid_id) {
		var div = $('#chat-' + jid_id + ' .chat-messages').get(0);
		div.scrollTop = div.scrollHeight;
	},

	presence_value : function(elem) {
		if (elem.hasClass('online')) {
			return 2;
		} else if (elem.hasClass('away')) {
			return 1;
		}

		return 0;
	},

	insert_contact : function(jid, elem) {
		//var jid = elem.find('.roster-jid').text();
		//var pres = Xpressive.presence_value(elem.find('.roster-contact'));

		var contacts = $('#roster-area li');

		if (contacts.length > 0) {
			var inserted = false;
			//			contacts.each(function() {
			//				var cmp_pres = Xpressive.presence_value($(this).find('.roster-contact'));
			//				var cmp_jid = $(this).find('.roster-jid').text();

			//				if (pres > cmp_pres) {
			//					$(this).before(elem);
			//					inserted = true;
			//					return false;
			//				} else {
			//					if (jid < cmp_jid) {
			//						$(this).before(elem);
			//						inserted = true;
			//						return false;
			//					}
			//				}
			//			});

			if (!inserted) {
				$('#roster-area ul').append(elem);
			}
		} else {
			$('#roster-area ul').append(elem);
		}
	},

	insert_room : function(room_id, elem) {
		var $room = $('#' + room_id);
		if ($room.length === 0) {
			$('#muc-area ul').append(elem);
		} else {
			$room.replaceWith(elem);
		}
	},

	send_ping : function(to) {
		var ping = $iq({
			to : to,
			type : "get",
			id : "ping1"
		}).c("ping", {
			xmlns : "urn:xmpp:ping"
		});

		Xpressive.log("Sending ping to " + to + ".");

		Xpressive.start_time = (new Date()).getTime();
		Xpressive.connection.send(ping);
	},

	handle_pong : function(iq) {
		var iq_type = $(iq).attr('type');
		var elapsed = (new Date()).getTime() - Xpressive.start_time;

		if (iq_type === 'error') {
			Xpressive.log("Received error from server in " + elapsed + "ms.");
		} else {
			Xpressive.log("Received pong from server in " + elapsed + "ms.");
		}

		return false;
	},

	show_traffic : function(body, type) {
		if (body.childNodes.length > 0) {
			var console = $('#console').get(0);
			var at_bottom = console.scrollTop >= console.scrollHeight - console.clientHeight;

			$.each(body.childNodes, function() {
				$('#console .log-messages').append("<div><span class='" + type + "'>" + Xpressive.pretty_xml(this) + "</span></div>");
			});

			if (at_bottom) {
				console.scrollTop = console.scrollHeight;
			}
		}
	},

	pretty_xml : function(xml, level) {
		var i, j;
		var result = [];
		if (!level) {
			level = 0;
		}

		result.push("<div class='xml_level" + level + "'>");
		result.push("<span class='xml_punc'>&lt;</span>");
		result.push("<span class='xml_tag'>");
		result.push(xml.tagName);
		result.push("</span>");

		// attributes
		var attrs = xml.attributes;
		var attr_lead = []
		for ( i = 0; i < xml.tagName.length + 1; i++) {
			attr_lead.push("&nbsp;");
		}
		attr_lead = attr_lead.join("");

		for ( i = 0; i < attrs.length; i++) {
			result.push(" <span class='xml_aname'>");
			result.push(attrs[i].nodeName);
			result.push("</span><span class='xml_punc'>='</span>");
			result.push("<span class='xml_avalue'>");
			result.push(attrs[i].nodeValue);
			result.push("</span><span class='xml_punc'>'</span>");

			if (i !== attrs.length - 1) {
				result.push("</div><div class='xml_level" + level + "'>");
				result.push(attr_lead);
			}
		}

		if (xml.childNodes.length === 0) {
			result.push("<span class='xml_punc'>/&gt;</span></div>");
		} else {
			result.push("<span class='xml_punc'>&gt;</span></div>");

			// children
			$.each(xml.childNodes, function() {
				if (this.nodeType === 1) {
					result.push(Xpressive.pretty_xml(this, level + 1));
				} else if (this.nodeType === 3) {
					result.push("<div class='xml_text xml_level" + (level + 1) + "'><span>");
					result.push(this.nodeValue);
					result.push("</span></div>");
				}
			});

			result.push("<div class='xml xml_level" + level + "'>");
			result.push("<span class='xml_punc'>&lt;/</span>");
			result.push("<span class='xml_tag'>");
			result.push(xml.tagName);
			result.push("</span>");
			result.push("<span class='xml_punc'>&gt;</span></div>");
		}

		return result.join("");
	},

	text_to_xml : function(text) {
		var doc = null;
		if (window['DOMParser']) {
			var parser = new DOMParser();
			doc = parser.parseFromString(text, 'text/xml');
		} else if (window['ActiveXObject']) {
			var doc = new ActiveXObject("MSXML2.DOMDocument");
			doc.async = false;
			doc.loadXML(text);
		} else {
			throw {
				type : 'XpressiveError',
				message : 'No DOMParser object found.'
			};
		}

		var elem = doc.documentElement;
		if ($(elem).filter('parsererror').length > 0) {
			return null;
		}
		return elem;
	}
};

$(document).ready(function() {
	var listShowing = "Contacts";

	$("#chat-area").tabs({//).scrollabletab({
		'closable' : true,
		'animationSpeed' : 50,
		'resizable' : true, //Default false
		'resizeHandles' : 'e,s,se', //Default 'e,s,se'
		'easing' : 'easeInOutExpo', //Default 'swing'
		//'event' : 'mouseover',
		'closableClick' : function(ev, data) {
			if (data.panel.id === "console") {
				return false;
			}
			// leave chat
			var jid = $('#' + data.panel.id).data('jid');
			Xpressive.connection.chat.endSession(jid);
			return true;	
		}
	});
	
	$('#client').resizable();
   
/**
 * TODO: DIALOGS 
 */

	$('#status_dialog').dialog({
		autoOpen : false,
		dragable : false,
		modal : true,
		title : 'Change Status',
		buttons : {
			"Update" : function() {
				var newStatus = $('input[name=status]:checked', '#status_dialog').val();
				var info = $('#status_info').val();
				info.trim();
				// update my status
				Xpressive.connection.me.changeStatus(newStatus, info);					
				
				$(this).dialog('close');
			}
		},
		open : function() {
			var x = "input[value='" + $(this).dialog('option','currentStatus') + "']";
			$(x, '#status_dialog').attr('checked', true); 
			$("#status_dialog").keypress(function(e) {
				if (e.keyCode == $.ui.keyCode.ENTER) {
					$(this).parent().find("button:eq(0)").trigger("click");
				}
			});		
		}			
	});
	
	$('#login_dialog').dialog({
		autoOpen : true,
		dragable : false,
		modal : true,
		title : 'Sign In',
		buttons : {
			"Connect" : function() {
				var password = $('#password').val().trim();
				if (password.length === 0)
					return;
				
				$(document).trigger('connect', {
					'jid' : $('#jid').val().trim(),
					'password' : password
				});

				//$('#password').val('');
				$(this).dialog('close');
			}
		},
		open : function() {
			$("#login_dialog").keypress(function(e) {
				if (e.keyCode == $.ui.keyCode.ENTER) {
					$(this).parent().find("button:eq(0)").trigger("click");
				}
			});
			// TODO: FOR TESTING ONLY
			$('#jid').val("ryan.giggs@taylor-home.com");
			$('#password').val("password");
		}
	});

	$('#contact_dialog').dialog({
		autoOpen : false,
		dragable : false,
		modal : true,
		open : function() {
			var _buttons = {};
			var _oper = $(this).dialog('option', 'type');
			var jid = $(this).dialog('option', 'jid');
			
			$('#contact-jid').val(jid).removeAttr('disabled');
			$('#contact-groups, #group-label').removeClass('hidden');
			
			if (_oper === "add") {
				$('#contact-name').removeAttr('disabled');
				$('#contact-groups').removeAttr('disabled');
				_buttons["Add"] = function() {
					var jid = $('#contact-jid').val();
					if (jid.length > 0) {
						Xpressive.connection.roster.addContact( jid, $('#contact-name').val(), $('#contact-groups').val());
		
						$('#contact-jid').val('');
						$('#contact-name').val('');
						$('#contact-groups').val('');
		
						$(this).dialog('close');
					};
				}
			} else if (_oper === "update") {
				$('#contact-jid').attr('disabled', 'true');
				$('#contact-name').val($(this).dialog('option', 'name')).focus();
				var groups = $(this).dialog('option', 'groups');
				$('#contact-groups').val((groups === "none" ? "" : groups));
				
				_buttons["Modify"] = function() {
					var _groups = $('#contact-groups').val().split(/[ ,]+/);
					var newGroups = _groups.join(" ");
					
					Xpressive.connection.roster.modifyContact( jid, $('#contact-name').val(), newGroups);
					$(this).dialog('close');
				};				
			} else if (_oper === "remove") {
				$('#contact-jid').attr('disabled', 'true');
				$('#contact-name').val($(this).dialog('option', 'name')).attr('disabled', 'true');
				$('#contact-groups, #group-label').addClass('hidden');
				
				_buttons["Remove"] = function() {
					Xpressive.connection.roster.deleteContact( jid);				
					$(this).dialog('close');
				};				
			}
			$(this).dialog('option', 'buttons', _buttons);
			
			$("#contact_dialog").keypress(function(e) {
				if (e.keyCode == $.ui.keyCode.ENTER) {
					$(this).parent().find("button:eq(0)").trigger("click");			
				}
			});
		}
	});

	$('#approve_dialog').dialog({
		autoOpen : false,
		dragable : false,
		modal : true,
		title : 'Subscription Request',
		buttons : {
			"Deny" : function() {
				Xpressive.connection.send($pres({
					to : $(this).dialog('option', 'jid'),
					"type" : "unsubscribed"
				}).tree());

				$(this).dialog('close');
			},

			"Approve" : function() {
				Xpressive.connection.send($pres({
					to : $(this).dialog('option', 'jid'),
					"type" : "subscribed"
				}).tree());

				// This contact is not on my roster so request subscription				  
				Xpressive.connection.send($pres({
					to : $(this).dialog('option', 'jid'),
					"type" : "subscribe"
				}).tree());
				
				$(this).dialog('close');
			}
		},
		open : function() {
			$("approve_jid").val($(this).dialog('option', 'jid'));
			$("#approve_dialog").keypress(function(e) {
				if (e.keyCode == $.ui.keyCode.ENTER) {
					$(this).parent().find("button:eq(1)").trigger("click");
				} else if (e.keyCode == $.ui.keyCode.ESCAPE) {
					$(this).parent().find("button:eq(0)").trigger("click");
				}
			});
		}
	});

	$('#chat_dialog').dialog({
		autoOpen : false,
		draggable : false,
		modal : true,
		title : 'Start a Chat',
		buttons : {
			"Start" : function() {
				var jid = $('#chat-jid').val();

				Xpressive.connection.chat.chatTo(jid);

				$('#chat-jid').val('');
				$(this).dialog('close');
			}
		},
		open : function() {
			$("#chat_dialog").keypress(function(e) {
				if (e.keyCode == $.ui.keyCode.ENTER) {
					$(this).parent().find("button:eq(0)").trigger("click");
				}
			});
		}
	});

	$('#join_room_dialog').dialog({
		autoOpen : false,
		draggable : false,
		modal : true,
		title : 'Join a Room',
		passwordRequired : false,
		buttons : {
			"Join" : function() {
				var jid = $(this).dialog('option', 'jid');
				var nick = $('#room-nickname').val().trim();
				var password = $('#room-password').val().trim();
				
				if (nick.length === 0 || (this.passwordRequired && password.length === 0 )) {					
					return;
				}				
				Xpressive.Connection.muc.join(jid, nick, password);

				$(this).dialog('close');
			}
		},
		open : function() {
			this.passwordRequired = $(this).dialog('option', 'secure');
			if (this.passwordRequired) {
				$('#room-password-div').removeClass('hidden')
			} else {
				$('#room-password-div').addClass('hidden')
			}
			$("#join_room_dialog").keypress(function(e) {
				if (e.keyCode == $.ui.keyCode.ENTER) {
					$(this).parent().find("button:eq(0)").trigger("click");
				}
			});
		}
	});

	$('#chat-area').tabs().find('.ui-tabs-nav').sortable({
		axis : 'x'
	});
	
/** 
 * TODO: CLICK EVENT HANDLERS
 */

	$(document).on('click', '.my-status', function() {
		var classList = $('#my-status').attr('class').split(/\s+/);
		classList.forEach( function(className) {
			if (className !== 'my-status') {
				switch (className){
					case 'available':
					case 'away':
					case 'xa':
					case 'chat':
					case 'dnd':
					case 'unavailable':
						$('#status_dialog').dialog('option', 'currentStatus', className);
						$('#status_dialog').dialog('open');
						break;
					
					case 'connecting':
					case 'connected':
					case 'authenticating':
					case 'disconnecting':
					case 'disconnected':
						break;
						
					case 'connfail':
					case 'authfail':
						break;
				}
				return;
			}
		});	
	});
	
	$(document).on('click', '.xmpp-chat-to-dlg', function() {
		$('#chat_dialog').dialog('open');
	});

	$(document).on('click', '.xmpp-change-details', function() {
		
		var $li = $(this).parents('li');
		var jid = $li.find('div .roster-jid').text();

		var contact = Xpressive.connection.roster.findContact(jid);
		$(document).trigger('modify_contact_details', contact);
	});
	
	$(document).on('click', '.xmpp-remove-contact', function() {
		
		var $li = $(this).parents('li');
		var jid = $li.find('div .roster-jid').text();
		
		var contact = Xpressive.connection.roster.findContact(jid);
		$(document).trigger('remove_contact', contact);
	});
	
	$(document).on('click', '.xmpp-chat-to', function() {
		
		var $li = $(this).parents('li');
		var jid = $li.find('div .roster-jid').text();

		Xpressive.connection.roster.chatTo(jid);
	});
	
	$(document).on('click', '.xmpp-join-room', function() {
		var $li = $(this).parents('li');
		var jid = $li.find(".room-jid").text();
		var name = $li.find(".room-name").text();
		var secure = Xpressive.connection.muc.isRoomSecure(jid);		
		var title = "Join: " + name;
		
		$('#join_room_dialog').dialog({ 'title' : title, 
										'secure' : secure, 
										'jid' : jid });
		$('#join_room_dialog').dialog('open');
	});

	$(document).on('click', '.xmpp-refresh-room', function() {
		var $li = $(this).parents('li');
		var jid = $li.find(".room-jid").text();
		Xpressive.connection.muc.refreshInfo(jid);
	});
	
	$(document).on('click', '.xmpp-add-contact', function() {
		$('#contact_dialog').dialog({ 'title' : "Add New Contact",
									  'jid' : "@taylor-home.com", 
									  'name' : "", 
									  'groups' : "", 
									  'type' : "add" });
		$('#contact_dialog').dialog('open');
	});

	$('#disconnect').click(function() {
		Xpressive.connection.session.disconnect();
	});

	$('#available-pres').click(function() {
		Xpressive.connection.me.available();
	});

	$('#away-pres').click(function() {
		Xpressive.connection.me.away();
	});

	$('#toggle-lists, .ui-list').click(function() {
		$('#toggle-lists').text('Show ' + listShowing);
		if (listShowing === "Contacts") {
			$('#roster-area').addClass('hidden');
			$('#muc-area').removeClass('hidden');
			listShowing = "Rooms";
		} else {
			$('#muc-area').addClass('hidden');
			$('#roster-area').removeClass('hidden');
			listShowing = "Contacts";
		}
	});

	$('#send_button').click(function() {
		var input = $('#input').val();
		var error = false;
		if (input.length > 0) {
			if (input[0] === '<') {
				var xml = Xpressive.text_to_xml(input);
				if (xml) {
					Xpressive.connection.send(xml);
					$('#input').val('');
				} else {
					error = true;
				}
			} else if (input[0] === '$') {
				try {
					var builder = eval(input);
					Xpressive.connection.send(builder);
					$('#input').val('');
				} catch (e) {
					console.log(e);
					error = true;
				}
			} else {
				error = true;
			}
		}

		if (error) {
			$('#input').animate({
				backgroundColor : "#faa"
			});
		}
	});

/**
 * TODO: KEYPRESS EVENT HANDLERS 
 */

	$(document).on('keypress', '.chat-input', function(ev) {
		var jid = $(this).parent().data('jid');
		var resource;
		var groupChat = $(this).parent().data('groupChat');
		
		if (ev.which === 13) {
			ev.preventDefault();

			var topic = $('.chat-topic').val(); 
			var body = $(this).val();
			Xpressive.connection.chat.sendNewMessage(jid, resource, body, groupChat);

			$(this).val('');
			$(this).parent().data('composing', false);
		} else {
			if (!groupChat){
				var composing = $(this).parent().data('composing');
				if (!composing) {
					Xpressive.connection.chatstates.sendComposing(jid);
	
					$(this).parent().data('composing', true);
				}
			}
		}
	});

	$(document).on('keypress', '.chat-topic', function(ev) {
		var jid = $(this).parent().data('jid');
		var groupChat = $(this).parent().data('groupChat');
		
		if (ev.which === 13) {
			ev.preventDefault();

			var topic = $(this).val();
			Xpressive.connection.chat.sendNewTopic(jid, topic);

			$(this).val('');
		}
	});

	$('#input').keypress(function() {
		$(this).css({
			backgroundColor : '#fff'
		});
	});

/**
 * TODO: MOUSE EVENT HANDLERS 
 */

	$(document).on('mouseenter', '.my-status', function ( e ) {
			var $elem = $( this );
			var $tooltip = $elem.find('div');
			var offset = $tooltip.offset();
			
			$elem.doTimeout( "hoverOut" );
			$elem.doTimeout( "hoverIn", 500, function () {
				$tooltip.css('left', e.pageX).css('top', e.pageY);
				$tooltip.fadeTo( 200, 1.0 );
			});
	});
	
	$(document).on( 'mouseleave', '.my-status', function ( e ) {
			var $elem = $( this );

			$elem.doTimeout( "hoverIn" );
			$elem.doTimeout( "hoverOut", 500, function () {
				$elem.find( "div" ).stop( true ).fadeOut();
			});
		});
	
	$(document).on('mouseenter', '.chat-text li', function ( e ) {
			var $li = $( this );
			var $div = $li.find('div');
			var offset = $div.offset();
			
			$li.doTimeout( "hoverOut" );
			$li.doTimeout( "hoverIn", 500, function () {
				$div.css('left', e.pageX).css('top', e.pageY);
				$div.fadeTo( 200, 1.0 );
			});
	});
	
	$(document).on( 'mouseleave', '.chat-text li', function ( e ) {
			var $li = $( this );

			$li.doTimeout( "hoverIn" );
			$li.doTimeout( "hoverOut", 500, function () {
				$li.find( "div" ).stop( true ).fadeOut();
			});
		});
	
	$(document).on('mouseenter', 'img', function ( e ) {
			var $img = $( this );
			var $div = $img.next('div');
			var offset = $div.offset();
			
			$img.doTimeout( "hoverOut" );
			$img.doTimeout( "hoverIn", 500, function () {
				$div.css('left', e.pageX).css('top', e.pageY);
				$div.fadeTo( 200, 1.0 );
			});
	});
	
	$(document).on( 'mouseleave', 'img', function ( e ) {
			var $img = $( this );

			$img.doTimeout( "hoverIn" );
			$img.doTimeout( "hoverOut", 500, function () {
				$img.next( "div" ).stop( true ).fadeOut();
			});
		});
		
/**
 * TODO: FUNCTIONS
 */
	
	function doResize() {
		var newH = $(this).height();
		$('.ui-resize').each(
			function() {
				$(this).height(newH - 84);
			}
		);
		$('.chat-messages').each(
			function() {
				var groupChat = $(this).parent().data('groupChat');
				$(this).height(newH - 84 - (groupChat === true ? 97 : 70));
			}
		);		
		$('.log-messages').each(
			function() {
				$(this).height(newH - 84 - 45);	
			}
		);
		var newW = $('#chat-area').width();
		$('.chat-input').each(
			function() {
				$(this).width(newW - 5);		
		});
		$('.chat-topic').each(
			function() {
				$(this).width(newW - 80);		
		});
	};
	
	$('.ui-resizable').resize(doResize);	

	$("#filter").val("Filter...").addClass("empty");
	
	// When you click on #filter
	$("#filter").focus(function(){
		
		// If the value is equal to "Filter..."
		if($(this).val() === "Filter...") {
			// remove all the text and the class of .empty
			$(this).val("").removeClass("empty");;
		}
		
	});
	
	// When the focus on #filter is lost
	$("#filter").blur(function(){
		
		// If the input field is empty
		if($(this).val() === "") {
			// Add the text "Filter..." and a class of .empty
			$(this).val("Filter...").addClass("empty");	
		}
		
	});

	Strophe.log = function(loglevel, message) {
		var level = "CUSTOM";
		switch (loglevel) {
			case 0 :
				level = "DEBUG";
				break;
			case 1:
				level = "INFO";
				break;
			case 2:
				level = "WARN";
				break;
			case 3 :
				level = "ERROR";
				break;
			case 4 :
				level = "FATAL";
				break;
		};
		Xpressive.log(level + ": " + message);
	};
});

$(document).bind('connect', function(ev, data) {
	var conn = new Strophe.Connection("http://taylor-home.com:5280/xmpp-httpbind");
	//var conn = new Strophe.Connection("http://bosh.metajack.im:5280/xmpp-httpbind");

	conn.xmlInput = function(body) {
		Xpressive.show_traffic(body, 'incoming');
	};

	conn.xmlOutput = function(body) {
		Xpressive.show_traffic(body, 'outgoing');
	};

	conn.connect(data.jid, data.password, function(status) {
		if (status === Strophe.Status.CONNECTED) {
			$(document).trigger('on_connected');
		} else if (status === Strophe.Status.DISCONNECTED) {
			$(document).trigger('on_disconnected');
		} else if (status === Strophe.Status.DISCONNECTING) {
			Xpressive.log('Connection disconnecting.');
		} else if (status === Strophe.Status.CONNFAIL) {
			Xpressive.log('Connection failed.');
		} else if (status === Strophe.Status.ERROR) {
			Xpressive.log('Connection errored.');
		} else if (status === Strophe.Status.AUTHFAIL) {
			Xpressive.log('Authorization failed.');
		}
	});
	Xpressive.connection = conn;

	$('#chat-area').tabs('add', '#console', "Debug");
	$('#console').append("<div class='log-messages' ></div>");
		
	$('#client').trigger('resize');
});

$(document).bind('on_connected', function() {
	// inform the user
	Xpressive.log("Connection established.");

	$('#disconnect').removeAttr('disabled');
});

$(document).bind('on_disconnected', function() {
	$('#disconnect').attr('disabled', 'disabled');
	Xpressive.log("Connection terminated.");

	// remove dead connection object
	Xpressive.connection = null;

	$('#roster-area ul').empty();
	$('#muc-area ul').empty();
	$('#chat-area ul').empty();
	$('#chat-area div').remove();
	
	$('#login_dialog').dialog('open');
});

$(document).bind('roster_changed', function(ev, data) {
	Xpressive.log("Roster Changed Event.");

	Xpressive.do_roster_changed(data);
});

$(document).bind('rooms_changed', function(ev, data) {
	Xpressive.log("Rooms Changed Event.");

	Xpressive.do_rooms_changed(data);
});

$(document).bind('room_changed', function(ev, data) {
	Xpressive.log("Room Changed Event.");

	Xpressive.do_room_changed(data);
});

$(document).bind('presence_changed', function(ev, data) {
	Xpressive.log("Presence Changed Event.");

	Xpressive.do_presence_changed(data);
	Xpressive.do_update_info(data);
});

$(document).bind('ask_subscription', function(ev, data) {
	Xpressive.log("Subscription Request Event.");
	
	Xpressive.do_ask_subscription(data);
});

$(document).bind('start_chatting', function(ev, data) {
	var chatSession = data;
	Xpressive.on_start_chat(chatSession.to, chatSession.name, chatSession.isGroupChat);
});

$(document).bind('join_room', function(ev, data) {
	var room = data;
	Xpressive.on_join_room(room.roomJid, room.roomName);
});

$(document).bind('new_chat_message', function(ev, data) {
	var message = data.message;
	var fromMe = data.fromMe;
	Xpressive.on_message(message, fromMe);
});

$(document).bind('remove_contact', function(ev, data) {
	var contact = data;
	
	
	$('#contact_dialog').dialog({ 'title' : "Confirm Remove Contact",
									'jid' : contact.jid, 
									'name' : contact.name, 
									'groups' : contact.getGroups(),
									'type' : 'remove' });
	$('#contact_dialog').dialog('open');
});

$(document).bind('modify_contact_details', function(ev, data) {
	var contact = data;
	
	$('#contact_dialog').dialog({ 'title' : "Modify Contact Details",
									'jid' : contact.jid, 
									'name' : contact.name, 
									'groups' : contact.getGroups(),
									'type' : 'update' });
	$('#contact_dialog').dialog('open');
});

$(document).bind('my_status_changed', function(ev, details) {
	if (details.jid.length > 0)
		$('#my-jid').text("[" + Strophe.getBareJidFromJid(details.jid) + "]");
	$('#my-status').removeClass().addClass(details.status + " my-status");
	$('#my-status .tooltip').text(details.extendedStatusToString());
	$('#my-nickname').text(details.getNickname());
});
