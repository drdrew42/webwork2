import {VuexModule, Module, Mutation, Action} from 'vuex-module-decorators';

// import Vue from 'vue';
// import Vuex from 'vuex';
import axios from 'axios';

import ProblemSet, {ProblemSetAttributes} from '@/models/ProblemSet';
import ProblemSetList from '@/models/ProblemSetList';
import Problem from '@/models/Problem';
import ProblemList from '@/models/ProblemList';
import User from '@/models/User';
import UserList from '@/models/UserList';
import Message from '@/models/Message';
import MessageList from '@/models/MessageList';
import Setting from '@/models/Setting';
import SettingList from '@/models/SettingList';
import LoginInfo from '@/models/LoginInfo';

import Vue from 'vue';
import Vuex from 'vuex';
Vue.use(Vuex);

const store = new Vuex.Store({});

@Module({
  name: 'WeBWorKStore',
  store,
  dynamic: true,
})
export default class WeBWorKStore extends VuexModule {

  public settings: SettingList =  new SettingList();
  public users: UserList =  new UserList();
  public problem_sets: ProblemSetList =  new ProblemSetList();
  public messages: MessageList =  new MessageList();
  public api_url: string = '/webwork3/api';
  public login_info: LoginInfo = new LoginInfo();

  @Mutation
  public UPDATE_LOGIN_INFO(_info: LoginInfo | {[key: string]: string | User}): void {
    if (_info instanceof LoginInfo) {
      this.login_info = _info;
    } else {
      // write this more elegantly
      for (const _key in Object.keys(_info)) {
        if (_key === 'course_id') {
          this.login_info.course_id = _info.course_id as string;
        } else if (_key === 'user') {
          this.login_info.logged_in_user = _info.user as User;
        }
      }
    }
  }

  @Mutation
  public SET_SETTINGS(_settings: SettingList): void {
    this.settings = _settings;
  }

  @Mutation
  public SET_SETTING(_setting: Setting): void {
    this.settings.set(_setting);
  }

    // User mutations
  @Mutation
  public SET_USERS(_users: UserList): void {
    this.users = _users;
  }
  @Mutation
  public SET_USER(_user: User): void {
    this.users.set(_user);
  }
  @Mutation
  public ADD_USER( _user: User): void {
    this.users.add(_user);
  }

    // ProblemSet mutations

  @Mutation
  public SET_PROBLEM_SETS(_sets: ProblemSetList): void {
    this.problem_sets = _sets;
  }
  @Mutation
  public ADD_PROBLEM_SET(_set: ProblemSet): void {
    this.problem_sets.set(_set);
  }
  @Mutation
  public REMOVE_PROBLEM_SET(_set: ProblemSet): void {
    this.problem_sets.remove(_set);
  }
  @Mutation
  public SET_PROBLEM_SET(_set: ProblemSet): void {
    this.problem_sets.set(_set);
  }

    // messages
  @Mutation
  public ADD_MESSAGE(_msg: Message): void {
    this.messages.add(_msg);
  }
  @Mutation
  public CLEAR_MESSAGES() {
    this.messages = new MessageList([]);
  }

  // return a list of all users except proctors
  get getUsers(): User[] {
    return this.users.filter( (_u: User) => ! /^set_id:/.test(_u.get('user_id')));
  }

  @Action
  public getAssignedUsers(setId: string): User[] {  // return all non-proctor users assigned to set_id
    const _set = this.problem_sets.get(setId);
    return _set ? _set.get('assigned_users').filter( (_u: User) => ! /^set_id:/.test(_u.get('user_id'))) : [];
  }

  @Action
  public getProblemSet(setId: string): ProblemSet { // return the set with given set_id
    return this.problem_sets.get(setId);
  }

  @Action
  public updateLoginInfo(_info: {[x: string]: any}): void {
    this.context.commit('UPDATE_LOGIN_INFO', _info);
  }

  // Settings actions
  @Action
  public async fetchSettings() {
    axios.get(this.api_url + '/courses/' + this.login_info.course_id + '/settings')
      .then((response) => {
        this.context.commit('SET_SETTINGS', response.data);
      })
      .catch((error) => {
        this.context.commit('SET_SETTINGS', []);
        // tslint:disable-next-line
        console.log(error);
      });
  } // fetchSettings

  @Action
  public async updateSetting(_setting: Setting) {
    axios.put(this.api_url + '/courses/' + this.login_info.course_id + '/setting', _setting.getAttributes())
    .then(() => {
      this.context.commit('SET_SETTING', _setting);
      // check that the response is the same as the _settting variable.
    })
    .catch( (error) => {
      // tslint:disable-next-line
      console.log(error);
    });

  }// updateSetting

    // Users Actions
  @Action
  public async fetchUsers() {
    axios.get(this.api_url + '/courses/' + this.login_info.course_id + '/users')
    .then((response) => {
      const _users = new UserList(response.data.map( (_u: {[key: string]: string}) => new User(_u)));
      this.context.commit('SET_USERS', _users);
    })
    .catch((error) => {
        this.context.commit('SET_USERS', []);
      // tslint:disable-next-line
      console.log(error);
    });
  } // fetchUsers

  @Action
  public async updateUser(_user: User) {
    // tslint:disable-next-line
    console.log("here");
    axios.put(this.api_url + '/courses/' + this.login_info.course_id + '/users/' + _user.get('user_id'), _user)
      .then((response) => {
        this.context.commit('SET_USER', response.data);
      })
      .catch((error) => {
        // tslint:disable-next-line
        console.log(error);
      });
  }
  @Action
  public async addUser(_user: User) {
    axios.post(this.api_url + '/courses/' + this.login_info.course_id + '/users/' + _user.get('user_id'), _user)
      .then((response) => {
        this.context.commit('ADD_USER', response.data);
      })
      .catch((error) => {
        // tslint:disable-next-line
        console.log(error);
      });
  }


  // Problem Set Actions

  @Action
  public async fetchProblemSets() {
    axios.get(this.api_url + '/courses/' + this.login_info.course_id + '/sets')
    .then((response) => {
      const _sets = new ProblemSetList(response.data.map( (_s: {[key: string]: any}) => new ProblemSet(_s)));
      this.context.commit('SET_PROBLEM_SETS', _sets);
    })
    .catch((error) => {
      // tslint:disable-next-line
      console.log("we triggered an error when mapping.");
      this.context.commit('SET_PROBLEM_SETS', []);
      // tslint:disable-next-line
      console.log(error);
    });
  } // fetchProblemSets

  @Action
  public async newProblemSet(_set: ProblemSet) {
    axios.post(this.api_url + '/courses/' + this.login_info.course_id + '/sets/' + _set.get('set_id'), _set)
    .then((response) => {
      this.context.commit('ADD_PROBLEM_SET', response.data);
    })
    .catch((error) => {
      // tslint:disable-next-line
      console.log(error);
    });
  } // newProblemSet

  @Action
  public async removeProblemSet(_set: ProblemSet) {
    axios.delete(this.api_url + '/courses/' + this.login_info.course_id + '/sets/' + _set.get('set_id'))
    .then((response) => {
      this.context.commit('REMOVE_PROBLEM_SET', response.data);
    })
    .catch((error) => {
      // tslint:disable-next-line
      console.log(error);
    });
  } // removeProblemSet

  @Action
  public async updateProblemSet(_set: ProblemSet) {
    axios.put(this.api_url + '/courses/' + this.login_info.course_id + '/sets/'
          + _set.get('set_id'), _set.getAttributes())
    .then((response) => {
      // tslint:disable-next-line
      console.log(_set);
      // this.context.commit('SET_PROBLEM_SET', response.data);
      // we should check that this worked.

      const keys = Object.keys(_set.getChanges());

      const _message = `The fields ${keys.join(', ')} have changed. `;

      this.context.commit('ADD_MESSAGE', new Message({message_id: Math.round(1000000 * Math.random()),
          message: _message}));
      // this.context.commit('ADD_MESSAGE', new Message(_set.getChanges()));
    })
    .catch((error) => {
      // tslint:disable-next-line
      console.log(error);
    });
  }

  // Messages
  @Action
  public addMessage(_msg: Message) {
    this.context.commit('ADD_MESSAGE', _msg);
  }
  @Action
  public clearMessages() {
    this.context.commit('CLEAR_MESSAGES');
  }

} // class Store
