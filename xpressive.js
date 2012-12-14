var Xpressive = {
	connection : null,
	start_time : null,
	Roster : function() { return Xpressive.connection.roster; },
	Muc : function() { return Xpressive.connection.muc; },
	Chat : function() { return Xpressive.connection.chat; },
	Me : function() { return Xpressive.connection.me; },
	Session : function() { return Xpressive.connection.session; },
	
	sessionDisconnect : function() {
		return Xpressive.Session().disconnect();
	},
	
	meGetMyNickname : function() {
		return Xpressive.Me().myDetails.getNickname();
	},
	
	meChangeStatus: function(newStatus, info) {
		return Xpressive.Me().changeStatus(newStatus, info);
	},
	
	chatEndSession : function(jid) {
		return Xpressive.Chat().endSession(jid);
	},
	
	mucGetRoom : function(jid) {
		return Xpressive.Muc().getRoom(jid);
	},
	
	mucDestroyRoom : function(jid, reason, altRoomJid, altRoomPassword) {
		return Xpressive.Muc().destroyRoom(jid, reason, altRoomJid, altRoomPassword);		
	},
	mucRefreshInfo : function(jid) {
		return Xpressive.Muc().refreshInfo(jid);
	},
	
	mucConfigureRoom : function(jid) {
		Xpressive.Muc().configureRoom(jid);
	},
	
	rosterFindContact : function(jid) {
		return Xpressive.Roster().findContact(jid);
	},
	
	rosterChatTo : function(jid) {
		return Xpressive.Roster().chatTo(jid);
	},
	
	rosterAddContact : function(jid, contactName, contactGroups) {
		return Xpressive.Roster().addContact(jid, contactName, contactGroups);
	},
	
	rosterModifyContact: function( jid, contactName, newGroups) {
		return Xpressive.Roster().modifyContact(jid, contactName, newGroups);
	},
	
	rosterDeleteContact : function(jid) {				
		return Xpressive.Roster().deleteContact(jid);				
	},
	
	settings : undefined,	

	jid_to_id : function(jid) {
		if (!jid)
			return "";
		return Strophe.getBareJidFromJid(jid).replace("@", "-").replace(/\./g, '-');
	},

	occupantJid_to_id : function(jid) {
		return jid.replace("@", "-").replace("/", "-").replace(/\./g, '-');
	},

	log : function(msg) {
		if ($('#console .log-messages').length > 0) {
			$('#console .log-messages').append("<div><span class='log'>" + msg + "</span></div>");
		}
		else {
			console.log(msg);
		}
	},

	getSettings : function() {		
		if (!Xpressive.settings)
		{
			Xpressive.settings = $.jStorage.get("Settings");
			if (!Xpressive.settings)
			{
				Xpressive.settings = {};
				// popup settings dialog
				$('#settings_dialog').dialog('open');
			}		
		}
		return Xpressive.settings;
	},

	setSettings : function(newSettings) {
		if (!Xpressive.settings) {
			Xpressive.settings = {};
		}
		$.each(newSettings, function(key, value) {			
			Xpressive.settings[key] = value;
		});
		$.jStorage.set("Settings", Xpressive.settings);
	},

	getSetting : function(key) {
		try {
			return Xpressive.getSettings()[key];
		} catch(ex) {
			return null;
		}
	},

	setSetting : function(key, value) {
		Xpressive.setSettings({key: value});
	},
	
	updateRoomName : function(roomJid, roomName) {
		var id = Xpressive.jid_to_id(roomJid);
		$('#chat-area > ul a[href="#chat-' + id + '"]').text(roomName);
	},

	updateContactName : function(contactJid, contactName) {
		var id = Xpressive.jid_to_id(contactJid);
		$('#roster-area > ul a[href="#' + id + '"]').text(contactName);
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
		var room_id = Xpressive.jid_to_id(room.jid);
		var numberOfOccupants = room.numberOfOccupants();
		var room_html = "<li id='" + room_id + "'>" + 
							"<div class='room-entry'>" + 
								"<div class='room-name'><span style='display:inline-block;'>" + room.roomName + "</span>";

		if (room.requiresPassword()) {
			room_html += "&nbsp;<img class='ui-icon ui-icon-key xmpp-protected' style='display:inline-block; vertical-align:bottom;'/>" +
							"<div class='tooltip'>Password required</div>";
		}

		room_html += "&nbsp;<img class='ui-icon ui-icon-pencil xmpp-configure-room' style='display:inline-block; vertical-align:bottom;'/>" +
						"<div class='tooltip'>Modify Room Settings.</div>";
						
		if (room.iAmModerator()){
			room_html += "&nbsp;<img class='ui-icon ui-icon-person xmpp-moderator' style='display:inline-block; vertical-align:bottom;'/>" +
							"<div class='tooltip'>You are a moderator</div>";
		}

		room_html += "&nbsp;<img class='ui-icon ui-icon-close xmpp-destroy-room' style='display:inline-block; vertical-align:bottom;'/>" +
						"<div class='tooltip'>Delete this Room.</div>";						

		room_html += "<img class='ui-icon ui-icon-refresh xmpp-refresh-room' style='display:inline-block; vertical-align:bottom;'/>" +
						"<div class='tooltip'>Click to refresh info</div>" +
					 "<img class='ui-icon ui-icon-play xmpp-join-room' style='display:inline-block; vertical-align:bottom;'/>" +
						"<div class='tooltip'>Click to join</div>";

		room_html += "</div>";
		//room_html += "<div class='room-description'>" + room.description();
		room_html += "<div class='room-jid'>" + room.jid + "</div>" +
								"<div><ul id='" + room_id + "-occupants' class='occupants-list";
		if (numberOfOccupants === "0") {
			room_html += " hidden";
		}
		room_html += "'><div style='display:inline-block;'><img class='ui-icon ui-icon-person xmpp-occupantCount' style='display:inline-block; vertical-align:bottom;'/>" +
							"<span style='font-size:75%; vertical-align:center;'>("+ numberOfOccupants +") Room Occupants</span></div>";

		if (numberOfOccupants !== "0") {
			for ( var occupantName in room.occupants) {
				room_html += this._getOccupantHtml(room.occupants[occupantName]);
			}
		}		
		room_html += "</ul></div></div></li>";

		Xpressive.insert_room(room_id, $(room_html));
	},
	
	do_update_room_occupant : function(occupant) {
		var fullJid = occupant.fullJid;
		var roomJid = Strophe.getBareJidFromJid(fullJid);
		var roomOccupants_id = Xpressive.jid_to_id(roomJid) + "-occupants";
		var elem_id = Xpressive.occupantJid_to_id(fullJid);
		var roomOccupantsList = $('ul#' + roomOccupants_id);
		var occupant_html = this._getOccupantHtml(occupant);
		Strophe.debug("Update occupants: " + occupant.toString());
		var liElem = $("li#" + elem_id);
		if (liElem && liElem.length > 0) {
			liElem.replaceWith(occupant_html);
		} else {
			roomOccupantsList.append($(occupant_html));
		}
	},

	do_remove_room_occupant : function(fullJid) {
		var roomJid = Strophe.getBareJidFromJid(fullJid);
		var roomOccupants_id = Xpressive.jid_to_id(roomJid) + "-occupants";
		var elem_id = Xpressive.occupantJid_to_id(fullJid);
		var roomOccupantsList = $('ul#' + roomOccupants_id);
		Strophe.debug("Remove occupant: " + fullJid);
		var liElem = $("li#" + elem_id);
		if (liElem && liElem.length > 0) {
			liElem.remove();
		}				
	},

	do_clear_room_occupants : function(room) {
		var roomOccupants_id = Xpressive.jid_to_id(room.jid) + "-occupants";
		var roomOccupantsList = $('ul#' + roomOccupants_id);
		roomOccupantsList.empty();				
	},
	
	_getOccupantHtml : function(occupant) {
		var fullJid = occupant.fullJid;
		var elem_id = Xpressive.occupantJid_to_id(fullJid);
		var status_html = "";
		var status = occupant.getStatus();
		if (occupant.thisIsMe) {
			status_html = " *me*"
		} else if (status.length > 0) {
			status_html = " [" + status + "]";	
		}
		return "<li id='" + elem_id + "'>" + occupant.nickname() + status_html + "</li>";
	},
	
	do_confirm_action : function(actionData) {
		$('#confirmation_dialog').dialog('option', 'title', actionData.title);		
		$('#confirmation_dialog').dialog('option', 'message', actionData.message);		
		$('#confirmation_dialog').dialog('option', 'okHandler', actionData.onOk);		
		$('#confirmation_dialog').dialog('option', 'cancelHandler', actionData.onCancel);		
		$('#confirmation_dialog').dialog('option', 'hideReason', actionData.hideReason);		
		$('#confirmation_dialog').dialog('option', 'userData', actionData.userData);		
		$('#confirmation_dialog').dialog('open');				
	},

	do_destroy_room : function(actionData) {
		$('#destroyRoom_dialog').dialog('option', 'title', actionData.title);		
		$('#destroyRoom_dialog').dialog('option', 'message', actionData.message);		
		$('#destroyRoom_dialog').dialog('option', 'okHandler', actionData.onOk);		
		$('#destroyRoom_dialog').dialog('option', 'cancelHandler', actionData.onCancel);		
		$('#destroyRoom_dialog').dialog('option', 'userData', actionData.userData);		
		$('#destroyRoom_dialog').dialog('open');				
	},

	do_create_room : function(data) {
		$('#form_dialog').dialog('option', 'title', "Configure Room [" + $(data.iq).attr('from') + "]");		
		$('#form_dialog').dialog('option', 'formIQ', data.iq);
		$('#form_dialog').dialog('option', 'okHandler', data.onOk);
		$('#form_dialog').dialog('option', 'cancelHandler', data.onCancel);
		$('#form_dialog').dialog('open');
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
			var name = contact.name || Strophe.getNodeFromJid(jid);
			var jid_id = Xpressive.jid_to_id(jid);

			Xpressive.log("    jid: " + jid + "[" + sub + "]");

			if (sub === 'remove') {
				// contact is being removed
				$('#roster-area li#' + jid_id).remove();
			} else {
				// contact is being added or modified
				var groups = contact.getGroups();
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
	
	do_log_chat_event : function(ev, data) {
		
		var jid = data.jid;
		var msg;
		
		switch (ev) {
			case "join":
				msg = data.name + " has joined.";
				break;
			case "leave":
				msg = data.name + " has left.";
				break;
			case "subject":
				msg = data.name + " has changed the topic to '" + data.topic + "'";
				break;
			default:
				msg = ev + " is unhandled.";
				break;
		}
		Xpressive.on_chat_event(msg, jid, data.timestamp || new Date());		
	},

	do_send_invite : function(data) {
		$('#sendInvite_dialog').dialog('option', 'room', data.room);		
		$('#sendInvite_dialog').dialog('option', 'cancelHandler', null);		
		$('#sendInvite_dialog').dialog('option', 'okHandler', data.okHandler);		
		$('#sendInvite_dialog').dialog('open');						
	},
	
	do_prompt_room_invite : function(data) {
		$("#roomInvitation_dialog").dialog('option', 'roomJid', data.roomJid);
		$("#roomInvitation_dialog").dialog('option', 'roomName', data.roomName);
		
		$("#roomInvitation_dialog").dialog('option', 'fromJid', data.fromJid);
		$("#roomInvitation_dialog").dialog('option', 'fromName', data.fromName);

		$("#roomInvitation_dialog").dialog('option', 'password', data.password);
		$("#roomInvitation_dialog").dialog('option', 'reason', data.reason);
		
		$("#roomInvitation_dialog").dialog('option', 'accept', data.accept);
		$("#roomInvitation_dialog").dialog('option', 'decline', data.decline);
		$("#roomInvitation_dialog").dialog('option', 'ignore', data.ignore);
		$("#roomInvitation_dialog").dialog('open');
	},
	
	updateRoomData : function(jid, affiliation, role) {
		var jid_id = Xpressive.jid_to_id(Strophe.getBareJidFromJid(jid));
		var chatTab = '#chat-' + jid_id;
		$('#chat-area ' + chatTab + ' #affil-value').text(affiliation);
		$('#chat-area ' + chatTab + ' #role-value').text(role);		
		if (affiliation === 'none') {
			$('#chat-area ' + chatTab + ' #affil-img').addClass('hidden');
		} else {		
			$('#chat-area ' + chatTab + ' #affil-img').removeClass('hidden');
			$('#chat-area ' + chatTab + ' #affil-tooltip').text(affiliation + " actions...");
		}
		if (role === 'none') {
			$('#chat-area ' + chatTab + ' #role-img').addClass('hidden');
		} else {		
			$('#chat-area ' + chatTab + ' #role-img').removeClass('hidden');
			$('#chat-area ' + chatTab + ' #role-tooltip').text(role + " actions...");
		}		
	},
	
	on_start_chat : function(jid, name, groupChat, room) {

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
				var hdrHtml = "<div class='groupchat-header'>" +
									"<div><span id='topic-label'>Topic : <input type='text' class='chat-topic' /></span></div>" +				
							  		"<div><span id='affil-label'>Affiliation : </span><span id='affil-value' class='capitalize'>" + 
							  						room.myAffiliation + "</span>" +
											"<span id='affil-img'>&nbsp;<img class='ui-icon ui-icon-play xmpp-affil-actions' " +
													   "style='display:inline-block; vertical-align:bottom;'/>" +							  				
												"<div id='affil-tooltip' class='tooltip capitalize'>Affiliation Actions.</div></span>" +							  				
							       		 "<span id='role-label'>  Role : </span><span id='role-value' class='capitalize'>" + 
							       					room.myRole + "</span>" +
											"<span id='role-img'>&nbsp;<img class='ui-icon ui-icon-play xmpp-role-actions' " +
													   "style='display:inline-block; vertical-align:bottom;'/>" +
												"<div id='role-tooltip' class='tooltip capitalize'>Role Actions.</div></span>" +
										 "<span id='invite-label'>Invite</span>" +
											"<span id='invite-img'>&nbsp;<img class='ui-icon ui-icon-play xmpp-invite-actions' " +
													   "style='display:inline-block; vertical-align:bottom;'/>" +							  				
												"<div id='invite-tooltip' class='tooltip capitalize'>Invite someone to join.</div></span>" +
							       	"</div>" +
							  "</div>";
				$(chatTab).append(hdrHtml);
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

	on_join_room : function(jid, name, room) {	
		this.on_start_chat(Strophe.getBareJidFromJid(jid), name, true, room);
	},

	on_chat_event : function(message, jid, timestamp) {
		jid_id = Xpressive.jid_to_id(jid);
		chatTab = '#chat-' + jid_id;
		Xpressive._add_message(chatTab, jid, message, "system", timestamp);
	},

	on_message : function(message, fromMe, messageTime) {
		var jid, full_jid, jid_id, chatTab, name, resource, composing, body, span, messageSender; 
		var	groupChat = false;
		var delay;
		var messageText;
		var timestamp = messageTime || new Date();
		
		if (fromMe) {
			messageSender = Xpressive.connection.me.jid;
			jid = Strophe.getBareJidFromJid($(message).attr('to'));
			Xpressive.log("Sending message to: " + jid);
			name = "Me";
		} else {
			full_jid = $(message).attr('from');
			jid = Strophe.getBareJidFromJid(full_jid);
			Xpressive.log("Got message from: " + jid);
		}

		jid_id = Xpressive.jid_to_id(jid);
		chatTab = '#chat-' + jid_id;
		groupChat = $(chatTab).data('groupChat') || false;
		if (!messageSender)
		{
			messageSender = (groupChat ? full_jid : jid);
		}
		
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
		/*
		delay = $(message).find('delay');
		if (delay.length === 0){
			delay = $(message).find('x');
		}
		if (delay.length !== 0){
			var stamp = delay.attr('stamp');
			timestamp = new Date(stamp);
		}
		*/
		topic = $(message).find('subject');
		if (topic.length > 0){
			topic = topic.text();
			$(chatTab + ' .chat-topic').val(topic);
			Xpressive.do_log_chat_event("subject", {
				"jid" : full_jid,
				"name" : name, 
				"topic" : topic,
				"timestamp" : messageTime })
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

				Xpressive._scroll_chat(chatTab);
			}
			// TODO let's ignore HTML content for now
			body = $(message).find("html > body");

			if (body.length === 0) {
				body = $(message).find('body');
				if (body.length > 0) {
					messageText = body.text()
				} else {
					messageText = null;
				}
			} else {
				messageText = body.text();
				/*
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
				messageText = span;
				*/
			}

			if (messageText) {
				// remove notifications since user is now active
				$(chatTab + ' .chat-event').remove();
				Xpressive._add_message(chatTab, messageSender, messageText, fromMe ? "me" : name, timestamp);
			}
		}
		return true;
	},
	
	_add_message : function(chatTab, messageSender, messageText, name, timestamp) {
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
		var timeString = Xpressive._formatDate(timestamp, "{FullYear}-{Month:2}-{Date:2} {Hours:2}:{Minutes:2}");
		if (appendUl) {
			$(chatTab + ' .chat-messages').append("<ul class='chat-message" + ( name === "me" || name === "system" ? " " + name + "'" : "'" ) + ">" + 
			                                    	"<span class='chat-message-group'><span class='chat-name'>" + name + "</span>:&nbsp;<span class='chat-time'>" + timeString + 
			                                    	"</span></span><span class='chat-text'></span></ul>");					
			lastUl = $(chatTab + ' ul').last().data('sender', messageSender);
		}
		$(chatTab + ' .chat-message:last .chat-text').append("<li>" + messageText + "<div class='chat-tooltip'>Message time : " + timeString + "</div></li>");

		Xpressive._scroll_chat(chatTab);
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

	_scroll_chat : function(chatTab) {
		var div = $(chatTab + ' .chat-messages').get(0);
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
		$('#roster-area ul').append(elem);
	},

	insert_room : function(room_id, elem) {
		var $room = $('#' + room_id);
		if ($room.length === 0) {
			$('#muc-area ul.room-details').append(elem);
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
			if (console) {
				var at_bottom = console.scrollTop >= console.scrollHeight - console.clientHeight;
	
				$.each(body.childNodes, function(index, node) {
					$('#console .log-messages').append("<div><span class='" + type + "'>" + Xpressive.pretty_xml(node) + "</span></div>");
				});
	
				if (at_bottom) {
					console.scrollTop = console.scrollHeight;
				}
			}
			else {
				console.log(Xpressive.pretty_xml(this));
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
			try {
				// children
				$.each(xml.childNodes, function(index, node) {
					if (node.nodeType === 1) {
						result.push(Xpressive.pretty_xml(node, level + 1));
					} else if (node.nodeType === 3) {
						result.push("<div class='xml_text xml_level" + (level + 1) + "'><span>");
						result.push(node.nodeValue);
						result.push("</span></div>");
					}
				});
			}
			catch (ex)
			{
				console.log(ex);
			}
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

/**
 * TODO: document.ready function
 */

$(document).ready(function() {

	$("#chat-area").tabs({//).scrollabletab({
		'closable' : true,
		'animationSpeed' : 50,
		'resizable' : true, //Default false
		'resizeHandles' : 'e,s,se', //Default 'e,s,se'
		'easing' : 'easeInOutExpo', //Default 'swing'
		//'event' : 'mouseover',
		'closableClick' : function(ev, data) {
			if (data.panel.id === "console") {
				// clear it
				$('#console .log-messages').empty();
				return false;
			}
			// leave chat
			var jid = $('#' + data.panel.id).data('jid');
			Xpressive.chatEndSession(jid);
			return true;	
		}
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
				$(this).height(newH - 84 - (groupChat === true ? 118 : 70));
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
				$(this).width(newW - 10);		
		});
		$('.chat-topic').each(
			function() {
				$(this).width(newW - 80);		
		});
		
		$('#muc-area ul.room-details').height(newH - 84 - 60);
		$('#roster-area ul.contact-details').height(newH - 84 - 60);
	};
	
	$('#client').resizable();
   
	$('#chat-area').tabs().find('.ui-tabs-nav').sortable({
		axis : 'x'
	});


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

	Xpressive.getSettings();
	
});
