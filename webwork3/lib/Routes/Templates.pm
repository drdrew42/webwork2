## This contains all of the html templates for the app
package Routes::Templates;

use Dancer2;
use Dancer2::FileUtils qw/path read_file_content/;
use Dancer2::Plugin::Auth::Extensible;  ## this handles the users and roles.  See the configuration file for setup.


use Utils::Authentication qw/buildSession/;
use Utils::Convert qw/convertObjectToHash/;
use Utils::CourseUtils qw/getCourseSettings getAllSets getAllUsers/;

use Data::Dump qw/dump/;

# This sets that if there is a template in the view direction a route is automatically generated.

set auto_page => 0;

any ['get','put','post','delete'] => '/courses/*/**' => sub {

  my ($course_id) = splat;

  debug "in /courses/*/**";
  debug session; 
  # send_error("The course has not been defined.  You may need to authenticate again",401)
	# 	unless (defined(session 'course'));

	$WeBWorK::Constants::WEBWORK_DIRECTORY = config->{webwork_dir};
	$WeBWorK::Debug::Logfile = config->{webwork_dir} . "/logs/debug.log";

  var ce => WeBWorK::CourseEnvironment->new({webwork_dir => config->{webwork_dir},
                                                courseName=> $course_id});
  var db => new WeBWorK::DB(vars->{ce}->{dbLayout});
	pass;
};

### this handles all logins

sub login_page_handler {
  debug "in login_page_handler";
	my $url = query_parameters->get("return_url");

	## parse the course_id from the $url;
	$url =~ /\/courses\/(\w+)\/(.*)/;
	my $course_id = $1;

	#my $ce =  WeBWorK::CourseEnvironment->new({webwork_dir => config->{webwork_dir},
  #                                              courseName=> $course_id});
  debug "forward /courses/" . $course_id . "/login";
  forward "/courses/" . $course_id . "/login";

  #return to_json(query_parameters->as_hashref);

#	return "hi";
}


get '/' => sub {
  return "Placeholder for toplevel";
};

get '/courses/:course_id/login' => sub {
  debug 'in GET /courses/:course_id/login';

  my $params = {course_id => route_parameters->{course_id},
                  return_url => query_parameters->{return_url}};
  if (params->{msg}){
    $params->{msg} =params->{msg};
  }
  template 'login.tt', $params, {layout=> undef};
};

post '/courses/:course_id/login' => sub {

  ## check that the password/username was correct.
  my ($success, $realm) = authenticate_user(
       body_parameters->{username}.';' . route_parameters->{course_id},  # hack to pass the course into this method
       body_parameters->{password}
   );
   if ($success) {
       session logged_in_user => body_parameters->{username};
       session logged_in_user_realm => $realm;
       # other code here
       debug "YEAH!!";
       debug query_parameters->{return_url};
       debug session;
       forward query_parameters->{return_url}, {}, {method => 'GET'};
   } else {  # authentication failed
     forward '/courses/' . route_parameters->{course_id} . '/login',
        {msg => 'login_failed'}, {method => 'GET'};
   }

};

post '/courses/:course_id/logout' => sub {
  app->destroy_session;

  ## what to return or to move to other route?
};

get '/courses/:course_id/hi' => require_login sub {
    #my $user = logged_in_user;
    debug session;
    return "Hi there, Fred"; # $user->{username}";
};


get '/courses/:course_id/manager' =>  sub {


	# read the course manager configuration file to set up the main and side panes

	my $configFilePath = path(config->{webwork_dir},"webwork3","public","js","apps","CourseManager","config.json");
	my $fileContents = read_file_content($configFilePath);
  my $config = from_json($fileContents);

	my @main_view_paths = map {$_->{path}} @{$config->{main_views}};
	my @sidepane_paths = map {$_->{path}} @{$config->{sidebars}};

	my @view_paths = (@main_view_paths,@sidepane_paths);

	# a few situations here.  Either
	# 1) the user is logged in and info stored as a cookie
	# 2) the user is logged in and info stored on the URL
	# 3) the user passed via the URL is not a member of the course
	# 4) the user passed via the URL is not authorized for the manager.
    # 5) the user hasn't already logged in and needs to pop open a login window.
	# 6) the user has already logged in and its safe to send all of the requisite data
	#



	my $userID = "";
	my $sessKey = "";
	my $ts = "";
	my $cookieValue = cookie "WeBWorK.CourseAuthen." . params->{course_id};

	# case 1)
	($userID,$sessKey,$ts) = split(/\t/,$cookieValue) if defined($cookieValue);

	debug "case 1";
    # case 2)
	if(! defined($cookieValue)){
		$userID = params->{user} if defined(params->{user});
		$sessKey = params->{key} if defined(params->{key});
	}

	debug "case 2";

	# check if the cookie user/key pair matches the params user/key pair
	#
	#    if not, set params to make sure that the login screen is popped open

	if(defined($cookieValue) && defined(params->{user}) && defined(params->{key})){
		if($userID ne params->{user} || $sessKey ne params->{key}){
			app->destroy_session;
			$userID = '';
			$sessKey = '';
		}
	}

	debug "case 3";

	## check if the user passed in via the URL is the same as the session user.

	if(session 'user'){
		if (session->{user} && $userID ne session->{user}) {
			my $key = vars->{db}->getKey(session 'user');
			vars->{db}->deleteKey(session 'user') if $key;
			app->destroy_session;
		}
	} elsif ($userID ne '') {
		session 'user' => $userID;
	} else {
		app->destroy_session;
	}

	#debug "case 4";
    # case 4)



	if($userID ne "" && ! vars->{db}->existsUser($userID)){
    	app->destroy_session;
		$userID = '';
		$sessKey = '';
	}


	# case 2)

    if ($userID ne "" && vars->{db}->getPermissionLevel($userID)->{permission} < 10){


    	redirect  vars->{ce}->{server_root_url} .'/webwork2/' . params->{course_id};
		return "You don't have access to this page.";
    }

	# case 5)
	my $settings = [];
	my $sets = [];
	my $users = [];

	# case 6)
	if(session 'user') {

		buildSession(session,vars->{ce},vars->{db});
		if(session 'logged_in'){
			$settings = getCourseSettings(vars->{ce});
			$sets = getAllSets(vars->{db},vars->{ce});
			$users = getAllUsers(vars->{db},vars->{ce});
		} else {
	     app->destroy_session;
		}
	}

	my $theSession = convertObjectToHash(session);
	$theSession->{effectiveUser} = session->{user};

	# set the ww2 style cookie to save session info for work in both ww2 and ww3.

	if(session && session 'user'){
		setCookie(session);
	}

	template 'course_manager.tt', {course_id=> params->{course_id},theSession=>to_json(convertObjectToHash(session)),
		theSettings=>to_json($settings), sets=>to_json($sets), users=>to_json($users), main_view_paths => to_json(\@view_paths),
		main_views=>to_json($config),pagename=>"Course Manager"},
		{layout=>'manager.tt'};
};


true;
