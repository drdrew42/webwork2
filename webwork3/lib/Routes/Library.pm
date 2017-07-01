### Library routes
##
#  These are the routes for all library functions in the RESTful webservice
#
##

package Routes::Library;

#use strict;
#use warnings;
use Dancer2 appname => "Routes::Login";
use Dancer2::Plugin::Database;
use Data::Dump qw/dump/;
use Path::Class;
use File::Find::Rule;
use Utils::Convert qw/convertObjectToHash convertArrayOfObjectsToHash/;
use Utils::LibraryUtils qw/list_pg_files searchLibrary getProblemTags render render2/;
use Utils::ProblemSets qw/record_results/;
use HTML::Entities qw/decode_entities/;
use WeBWorK::DB::Utils qw(global2user);
use WeBWorK::Utils::Tasks qw(fake_user fake_set fake_problem);
use WeBWorK::PG::Local;
use WeBWorK::Constants;
use Data::Dump qw/dd/;

get '/Library/subjects' => sub {

	my $webwork_dir = config->{webwork_dir};
	my $file = "$webwork_dir/htdocs/DATA/library-subject-tree.json";
	my $json_text = do {
   		open(my $json_fh, "<:encoding(UTF-8)", $file)  or send_error("The file $file does not exist.",404);
	    local $/;
	    <$json_fh>
	};
	return decode_json($json_text);

};

####
#
#  get all problems with subject *subject_id* and chapter *chapter_id* and section *section_id*
#
#   returns a array of problem paths? (global problem_id's)?
#
#  should pass in an limit on number of problems to return (100 for default?)
#
####


get qr{\/Library\/subjects\/(.+)\/chapters\/(.+)\/sections\/(.+)\/problems} => sub {

	my ($subj,$chap,$sect) = splat;

	return searchLibrary(database,{subject=>$subj,chapter=>$chap,section=>$sect});
};


####
#
#  get all problems with subject *subject_id* and chapter *chapter_id*
#
#   returns a array of problem paths? (global problem_id's)?
#
#  should pass in an limit on number of problems to return (100 for default?)
#
####

get qr{\/Library\/subjects\/(.+)\/chapters\/(.+)\/problems} => sub {

	my ($subj,$chap) = splat;

	return searchLibrary(database,{subject=>$subj,chapter=>$chap});
};


####
#
#  get all problems with subject *subject_id*
#
#   returns a array of problem paths? (global problem_id's)?
#
#  should pass in an limit on number of problems to return (100 for default?)
#
####


get qr{\/Library\/subjects\/(.+)\/problems} => sub {

	my ($subj) = splat;

	return searchLibrary(database,{subject=>$subj});
};




#######
#
#  get '/library/directories'
#
#  return the directory tree of the library
#
####

get '/Library/directories' => sub {

	my $webwork_dir = config->{webwork_dir};
	my $file = "$webwork_dir/htdocs/DATA/library-directory-tree.json";

	my $json_text = do {
   		open(my $json_fh, "<:encoding(UTF-8)", $file)  or send_error("The file $file does not exist.",404);
	    local $/;
	    <$json_fh>
	};



	return decode_json $json_text;

};

#######
#
#  get '/library/directories'
#
#  return all the problems for a given directory in the library.
#
####

get '/Library/directories/**' => sub {

	## pstaab: trying to figure out the best way to pass the course_id.  It needs to be passed in as a parameter for this
	##         to work.

	my ($dirs) = splat;
	my @dirs =  shift @{$dirs};# strip the "OpenProblemLibrary" from the path
	my $path = vars->{ce}->{courseDirs}{templates} ."/Library/". join("/",@$dirs);
	my $header = vars->{ce}->{courseDirs}{templates} . "/";
	my @files = File::Find::Rule->file()->name('*.pg')->in($path);
	my @allFiles =  map { $_ =~ s/$header//; {source_file=>$_}} @files;
	return \@allFiles;
};


#######
#
#  get '/library/local'
#
#  return all the problems in the course/templates directory
#
####

get '/courses/:course_id/Library/local' => sub {

	debug "in /Library/local";

	## still need to search for directory with single files and others with ignoreDirectives.

	my $path = dir(vars->{ce}->{courseDirs}{templates});
	my $probLibs = vars->{ce}->{courseFiles}{problibs};

	my $libPath = $path . "/" . "Library";  # hack to get this to work.  Need to make this more robust.
	#my $parentPath =  $path->parent;

	my @files = ();

	$path->recurse( preorder=>1,callback=>sub {
		my ($dir) = @_;
		if ($dir =~ /^$libPath/){
			return Path::Class::Entity::PRUNE(); # don't follow into the Library directory
		} else {
			my $relDir = $dir;
			$relDir =~ s/^$path\/(.*)/$1/;
			if(($dir =~ /.*\.pg$/) && not($dir =~ /Header/)){  ## ignore any file with Header in it.
				push(@files,$relDir);
			}
		}
	});
	my @allFiles =  map { {source_file=>$_} }@files;
	return \@allFiles;

};


#######
#
#  get '/courses/:course_id/library/setDefinition'
#
#  return all the problems in any setDefinition file in the local library.
#
####

get '/courses/:course_id/Library/setDefinition' => sub {

	debug "in /Library/setDefinition";

	## still need to search for directory with single files and others with ignoreDirectives.


	my $path = dir(vars->{ce}->{courseDirs}{templates});
	my $probLibs = vars->{ce}->{courseFiles}{problibs};

	my $libPath = $path . "/" . "Library";  # hack to get this to work.  Need to make this more robust.
	#my $parentPath =  $path->parent;

	my @setDefnFiles = ();

	$path->recurse( preorder=>1,callback=>sub {
		my ($dir) = @_;
		if ($dir =~ /^$libPath/){
			return Path::Class::Entity::PRUNE(); # don't follow into the Library directory
		} else {
			my $relDir = $dir;
			$relDir =~ s/^$path\/(.*)/$1/;
			if($dir =~ m|/set[^/]*\.def$|) {
				push(@setDefnFiles,$relDir);
			}
		}
	});

	## read the set definition files for pg files

	my @pg_files = ();

	for my $filePath (@setDefnFiles){
		my ($line, $got_to_pgs, $name, @rest) = ("", 0, "");
		debug "$path/$filePath";
		if ( open (SETFILENAME, "$path/$filePath") )    {
			while($line = <SETFILENAME>) {
				chomp($line);
				$line =~ s|(#.*)||; # don't read past comments
				if($got_to_pgs) {
					unless ($line =~ /\S/) {next;} # skip blank lines
					($name,@rest) = split (/\s*,\s*/,$line);
					$name =~ s/\s*//g;
					push @pg_files, $name;
				} else {
					$got_to_pgs = 1 if ($line =~ /problemList\s*=/);
				}
			}
		} else {
			debug("oops");
		}
	}

	my @allFiles =  map { {source_file=>$_} } @pg_files;
	return \@allFiles;

};


####
#
#   get '/Library/textbooks'
#
#   returns a JSON file that contains all of the textbook information
#
####

get '/Library/textbooks' => sub {

	my $webwork_dir = config->{webwork_dir};
	my $file = "$webwork_dir/htdocs/DATA/textbook-tree.json";
	my $json_text = do {
   		open(my $json_fh, "<:encoding(UTF-8)", $file)  or send_error("The file $file does not exist.",404);
	    local $/;
	    <$json_fh>
	};

	return $json_text;

};

####
#
#  get '/Library/textbooks/:textbook_id/chapters/:chapter_id/sections/:section_id/problems'
#
#  returns all problems in the given textbook/chapter/section
#
##

get '/Library/textbooks/:textbook_id/chapters/:chapter_id/sections/:section_id/problems' => sub {

	return searchLibrary(database,{section_id=>params->{section_id},textbook_id=>params->{textbook_id},
			chapter_id=>params->{chapter_id}});

};

####
#
#  get '/Library/textbooks/:textbook_id/chapters/:chapter_id/problems'
#
#  returns all problems in the given textbook/chapter
#
##

get '/Library/textbooks/:textbook_id/chapters/:chapter_id/problems' => sub {

	return searchLibrary(database,{textbook_id=>params->{textbook_id},chapter_id=>params->{chapter_id}});

};

####
#
#  get '/Library/textbooks/:textbook_id/problems'
#
#  returns all problems in the given textbook
#
##

get '/Library/textbooks/:textbook_id/problems' => sub {

	return searchLibrary(database,{textbook_id=>params->{textbook_id}});

};

####
#
#  The following are used when getting problems from textbooks (from the Library Browser)
#
####

get '/textbooks/author/:author_name/title/:title/problems' => sub {

	return searchLibrary(database,{textbook_author=>params->{author_name},textbook_title=>params->{title}});

};

get '/textbooks/author/:author_name/title/:title/chapter/:chapter/problems' => sub {

	return searchLibrary(database,{textbook_author=>params->{author_name},textbook_title=>params->{title},
			textbook_chapter=>params->{chapter}});

};

get '/textbooks/author/:author_name/title/:title/chapter/:chapter/section/:section/problems' => sub {

	return searchLibrary(database,{textbook_author=>params->{author_name},textbook_title=>params->{title},
			textbook_chapter=>params->{chapter},textbook_section=>params->{section}});

};




####
#
##  get '/library/problems'
#
#  search the library.  Any of the problem metadata can be called as a parameter to this
#
#  return an array of problems that fit the criteria
#
# ###

get '/library/problems' => sub {

	my $searchParams = {};
	for my $key (qw/keyword level author institution subject chapter section section_id textbook_id chapter_id/){
		$searchParams->{$key} = params->{$key} if defined(params->{$key});
	}

	return searchLibrary(database,$searchParams);

};

###
#
#  get '/Library/problems/:problem_id/tags'
#
#  This returns all of the tags from the DB for a problem
#
##

get '/Library/problems/:problem_id/tags' => sub {

	return getProblemTags(params->{problem_id});
};

###
#
# Problem render.  Given information about the problem (problem_id, set_id, course_id, or path) return the
# HTML for the problem.
#
#  The displayMode parameter will determine the exact HTML code that is returned (images, MathJax, plain, PDF)
#
#  The intention of this route is for rendering a particular problem (i.e. for the library browser)
#
###

any ['get', 'post'] => '/renderer/courses/:course_id/problems/:problem_id' => sub {

	debug "in /renderer/courses/:course_id/problems/:problem_id";

	my $renderParams = {
		displayMode => query_parameters->get('displayMode') || body_parameters->get('displayMode')
			|| vars->{ce}->{pg}{options}{displayMode},
		show_hints => query_parameters->get('showHints') || body_parameters->get('showHints') || 0,
	  show_solutions => query_parameters->get('showSolutions') || body_parameters->get('showSolutions') || 0,
		show_answers => query_parameters->get('showAnswers') || body_parameters->get('showAnswers') || 0,
		problem => {
			problem_seed => query_parameters->get('problem_seed') || body_parameters->get('problem_seed') || 1,
			problem_id => query_parameters->get('problem_id') || body_parameters->get('problem_id') || 1
		}
	};
	#
  # $renderParams->{displayMode} =
	# $renderParams->{problemSeed} = ;
	# $renderParams->{showHints} = 0;
	# $renderParams->{showSolutions} = 0;
	# $renderParams->{showAnswers} = 0;
	#
	# $renderParams->{user} = fake_user(vars->{db});
	# $renderParams->{set} =  fake_set(vars->{db});
	# $renderParams->{problem} = fake_problem(vars->{db});
	# $renderParams->{problem}->{problem_seed} = query_parameters->{problem_seed} || 0;
	# $renderParams->{problem}->{problem_id} = query_parameters->{problem_id} || 1;

	# check to see if the problem_path is defined

	if (defined(params->{problem_path})){
		$renderParams->{problem}->{source_file} = "Library/" . query_parameters->{problem_path};
	} elsif (defined(params->{source_file})){
		$renderParams->{problem}->{source_file} = query_parameters->{source_file};
	} elsif ((params->{problem_id} =~ /^\d+$/) && (query_parameters->{problem_id} > 0)){
			# try to look up the problem_id in the global database;

		my $problem_info = database->quick_select('OPL_pgfile', {pgfile_id => route_parameters->{problem_id}});
		my $path_id = $problem_info->{path_id};
		my $path_header = database->quick_select('OPL_path',{path_id=>$path_id})->{path};
		$renderParams->{problem}->{source_file} = "Library/" . $path_header . "/" . $problem_info->{filename};
	}

	debug $renderParams;

	return render(vars->{ce},vars->{db},$renderParams);

};

###
#
# Problem render for a UserProblem.  Given information about the problem (problem_id, set_id, course_id, or path) return the
# HTML for the problem.
#
#  The displayMode parameter will determine the exact HTML code that is returned (images, MathJax, plain, PDF)
#
#  If the request is a post, then it is assumed that the answers are submitted to be recorded.
#
###

any ['get', 'post'] => '/renderer/courses/:course_id/users/:user_id/sets/:set_id/problems/:problem_id' => sub {

	send_error("The set " . params->{set_id} . " does not exist.",404) unless vars->{db}->existsGlobalSet(params->{set_id});

	send_error("The problem with id " . params->{problem_id} . " does not exist in set " . params->{set_id},404)
		unless vars->{db}->existsGlobalProblem(params->{set_id},params->{problem_id});

	send_error("The user " . params->{user_id} . " is not assigned to the set " . params->{set_id} . ".")
		unless vars->{db}->existsUserProblem(params->{user_id},params->{set_id},params->{problem_id});


	my $renderParams = {};

  $renderParams->{displayMode} = param('displayMode') || vars->{ce}->{pg}{options}{displayMode};

    ### The user is not a professor

  if(session->{permission} < 10){  ### check that the user belongs to the course and set.

  	send_error("You are a student and must be assigned to the set " . params->{set_id},404)
  		unless (vars->{db}->existsUser(param('user_id')) &&  vars->{db}->existsUserSet(param('user_id'), params->{set_id}));

  	# these should vary depending on number of attempts or due_date or ???
  	$renderParams->{showHints} = 0;
  	$renderParams->{showSolutions} = 0;
  	$renderParams->{showAnswers} = 0;

  } else {
		$renderParams->{showHints} = defined(param('show_hints'))? int(param('show_hints')) : 0;
		$renderParams->{showSolutions} = defined(param('show_solutions'))? int(param('show_solutions')) : 0;
		$renderParams->{showAnswers} = defined(param('show_answers'))? int(param('show_answers')) : 0;
  }

	$renderParams->{problem} = vars->{db}->getMergedProblem(params->{user_id},params->{set_id},params->{problem_id});
	$renderParams->{user} = vars->{db}->getUser(params->{user_id});
	$renderParams->{set} = vars->{db}->getMergedSet(params->{user_id},params->{set_id});

	my $results = render(vars->{ce},vars->{db},$renderParams);


	## if it was a post request, then we record the the results in the log file and in the past_answer database
	if(request->is_post){
		$results->{recorded_msg} = record_results($renderParams,$results);
	}

	return $results;


};


###
#  This is a generic path that renders a problem if the source is passed to it.
#
#  Note: this is mainly for testing and for scripts to renderer a number of a problems in a directory.
#
###


post '/renderer' => sub {

	my $source = decode_entities params->{source} if defined(params->{source});

	my $problem = fake_problem(vars->{db});
	$problem->{problem_seed} = params->{seed} || 1;
	$problem->{problem_id} = 1;
	$problem->{source_file} = params->{source_file} || "this_is_a_fake_path";

    my $renderParams = {
		displayMode=>"MathJax",
		showHints=>0,
		showSolutions=>0,
		showAnswers=>0,
		problemSeed=>1,
		user => fake_user(vars->{db}),
		set => fake_set(vars->{db}),
		problem => $problem,
		source => defined($source)?\$source: undef
	};

	return render(vars->{ce},vars->{db},$renderParams);
};


1;
