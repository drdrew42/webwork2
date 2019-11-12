import Model from './Model';
import UserList from './UserList';
import ProblemList from './ProblemList';
import Problem from './Problem';

export interface ProblemSetAttributes {
  set_id: string;
  assigned_users: string[];
  problems: ProblemList;
  set_header: string;
  hardcopy_header: string;
  open_date: number;
  due_date: number;
  answer_date: number;
  reduced_scoring_date: number;
  visible: boolean;
  enable_reduced_scoring: boolean;
  assignment_type: string;
  description: string;
  restricted_release: string;
  restricted_status: number;
  attempts_per_version: number;
  time_interval: number;
  versions_per_interval: number;
  version_time_limit: number;
  version_creation_time: number;
  problem_randorder: boolean;
  version_last_attempt_time: number;
  problems_per_page: number;
  hide_score: string;
  hide_score_by_problem: string;
  hide_work: string;
  time_limit_cap: number;
  restrict_ip: string;
  relax_restrict_ip: string;
  restricted_login_proctor: string;
  hide_hint: boolean;
  restrict_prob_progression: boolean;
  email_instructor: boolean;
}

export default class ProblemSet extends Model {

  protected _idAttribute = 'set_id';

  constructor(attrs?: object, opts?: {parse: boolean}) {
    super(attrs, opts);
  }

  public defaults(): ProblemSetAttributes {
    return {
      set_id: '',
      assigned_users: [],  // array of user_id's
      problems: new ProblemList(),
      set_header: '',
      hardcopy_header: '',
      open_date: 0,
      due_date: 0,
      answer_date: 0,
      reduced_scoring_date: 0,
      visible: false,
      enable_reduced_scoring: false,
      assignment_type: 'set',
      description: '',
      restricted_release: '',
      restricted_status: 0,
      attempts_per_version: -1,
      time_interval: 0,
      versions_per_interval: 0,
      version_time_limit: 0,
      version_creation_time: 0,
      problem_randorder: false,
      version_last_attempt_time: 0,
      problems_per_page: 1,
      hide_score: 'Y',
      hide_score_by_problem: 'Y',
      hide_work : 'Y',
      time_limit_cap: 0,
      restrict_ip: 'No',
      relax_restrict_ip: 'No',
      restricted_login_proctor: 'No',
      hide_hint: false,
      restrict_prob_progression: false,
      email_instructor: false,
    };
  }

  public getAttributes(): ProblemSetAttributes {
    const all_attrs = Array.from(this._attrs).reduce((obj, [key, value]) => (
      Object.assign(obj, { [key]: value })
    ), this.defaults());
    const _probs = this.get('problems').models().map( (_prob: Problem) => _prob.getAttributes() );
    all_attrs.problems = _probs;
    return all_attrs;
  }

  public dataTypes(): {[key: string]: string | RegExp} {
    return {
      set_id: /^[a-zA-Z0-9_](\w)*/,
      open_date: 'nonnegint',
      reduced_scoring_date:  'nonnegint',
      due_date: 'nonnegint',
      answer_date:  'nonnegint',
      assigned_users: 'UserList',
    };
  }

  public required_fields() {
    return ['set_id'];
  }

  protected parse(attrs: {[key: string]: any}): void {
    const _probs = attrs.problems || [];
    this._attrs.set('problems', new ProblemList(_probs.map( (_prob: {[key: string]: any}) => new Problem(_prob))));
    delete attrs.problems;
    super.parse(attrs);
  }

} // class Problem Set
