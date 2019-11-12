<template>
  <li class="problem p-2 rounded">
    <b-container>
      <b-row>
        <b-col cols="6">
          <b-row>
            <b-col cols="2" v-if="prop.numbered">
              <b-input-group size="sm">
                <span class="problem-id">{{problem.get('problem_id')}}</span>
              </b-input-group>
            </b-col>
            <b-col cols="5" v-if="prop.value">
              <b-input-group size="sm">
                <b-input-group-text slot="prepend">Value:</b-input-group-text>
                <b-input type="number" v-model="value"/>
              </b-input-group>
            </b-col>
            <b-col cols="5" v-if="prop.attempts">
              <b-input-group size="sm" prepend="Max. Att.:">
                <b-input type="number" v-model="max_attempts"/>
              </b-input-group>
            </b-col>
          </b-row>
        </b-col>
        <b-col cols="5">
          <b-btn-toolbar>
            <b-btn-group size="sm">
              <b-btn variant="outline-dark" title="add problem" v-if="prop.add"
                  @click="$emit('add-problem',problem)">
                  <font-awesome-icon icon='plus'/>
                </b-btn>
              <b-btn variant="outline-dark" title="edit" v-if="prop.edit" disabled>
                <font-awesome-icon icon='pencil-alt'/>
              </b-btn>
              <b-btn variant="outline-dark" title="randomize" v-if="prop.randomize"
                @click="randomize"> <font-awesome-icon icon='sync'/>
              </b-btn>
              <b-btn variant="outline-dark" title="delete problem" v-if="prop.delete">
                <font-awesome-icon icon='trash-alt'/>
              </b-btn>
              <b-btn variant="outline-dark" title="Mark this problem correct for all assigned users."
                  v-if="prop.mark_all" disabled><font-awesome-icon icon='check'/>
                </b-btn>
              <b-btn variant="outline-dark" title="show/hide tags" v-if="prop.tags">
                <font-awesome-icon icon='tags'/>
              </b-btn>
              <b-btn :variant="show_path ? 'success' : 'outline-dark'" title="show/hide path" v-if="prop.path"
                  @click="show_path = !show_path"><font-awesome-icon icon='file'/>
                </b-btn>
              <b-btn variant="outline-dark" title="This problem is in the target set." v-if="prop.target_set">
                <font-awesome-icon icon='bullseye'/>
              </b-btn>
            </b-btn-group>
          </b-btn-toolbar>
        </b-col>
        <b-col cols="1">
          <b-btn-group size="sm" class="float-right" v-if="prop.reorder">
            <b-btn class="drag-handle border border-dark rounded p-2" variant="outline-dark">
              <font-awesome-icon icon="arrows-alt-v" />
            </b-btn>
          </b-btn-group>
        </b-col>
      </b-row>
      <b-row v-if="show_path">
        Path: {{problem.source_file}}
      </b-row>
      <b-row>
        <div v-if="html == ''" class="text-center">
          <b-spinner variant="info" />
        </div>
        <div v-else class="problem-tag-container" v-html="html"></div>
      </b-row>
    </b-container>
  </li>

</template>



<script lang="ts">
import { Vue, Component, Watch, Prop } from 'vue-property-decorator';
import axios from 'axios';

// set up the store
import { getModule } from 'vuex-module-decorators';
import WeBWorKStore from '@/store';
const store = getModule(WeBWorKStore);

import Problem from '@/models/Problem';

@Component({
  name: 'ProblemView', // name of the view
})
export default class ProblemView extends Vue {
  private html: string = '';
  private show_tags: boolean = false;
  private show_path: boolean = false;

  @Prop()
  private problem!: Problem;
  @Prop()
  private type!: string;

  public mounted() {
    this.fetchProblem();
  }

  private fetchProblem(otherParams?: {[key: string]: any}) {
    this.html = '';
    axios.get('/webwork3/api/renderer/courses/' + store.login_info.course_id +
                '/users/' + store.login_info.logged_in_user.get('user_id') +
                '/sets/' + this.problem.get('set_id') +
                '/problems/' + this.problem.get('problem_id'),
                {params: Object.assign({}, this.problem.getAttributes(), otherParams)})
        .then( (response) => {
          this.html = response.data.text;
        });
  }

  get prop(): ProblemViewOptions {
    return this.type === 'library' ? LIB_PROB : SET_PROB;
  }

  get value(): number {
    return this.problem.get('value');
  }

  set value(value: number) {
    if (value !== this.problem.get('value')) {
      // update the problem.
      // tslint:disable-next-line
      console.log(value);
    }
  }

  get max_attempts(): number {
    return this.problem.get('max_attempts');
  }

  set max_attempts(value: number) {
    if (value !== this.problem.get('max_attempts')) {
      // update the problem.
      // tslint:disable-next-line
      console.log(value + ":" + this.problem.get('max_attempts'));
    }
  }

  private addProblem(evt: Event): void {
    // tslint:disable-next-line
    console.log(evt);
  }

  private randomize(): void {
    this.fetchProblem({problem_seed: Math.floor(10000 * Math.random())});
  }

  @Watch('problem')
  private problemChange(): void {
    this.fetchProblem();
  }


  private updated(): void {
    MathJax.Hub.Queue(['Typeset', MathJax.Hub]);
  }
}

interface ProblemViewOptions {
  numbered: boolean;
  reorder: boolean;
  add: boolean;
  value: boolean;
  attempts: boolean;
  edit: boolean;
  randomize: boolean;
  delete: boolean;
  mark_all: boolean;
  tags: boolean;
  path: boolean;
  target_set: boolean;
}

const LIB_PROB: ProblemViewOptions = { // define characteristics of a library problem.
  numbered: false,
  reorder: false,
  add: true,
  value: false,
  attempts: false,
  edit: true,
  randomize: true,
  delete: false,
  mark_all: false,
  tags: true,
  path: true,
  target_set: true,
};

const SET_PROB: ProblemViewOptions = { // define characteristics of a library problem.
  numbered: true,
  reorder: true,
  add: false,
  value: true,
  attempts: true,
  edit: true,
  randomize: true,
  delete: true,
  mark_all: true,
  tags: false,
  path: false,
  target_set: false,
};
</script>

<style>
.problem-id {font-weight: bold; font-size: 120%; padding-right: 1ex;}
.problem {
  list-style: none;
  border: 1px black solid;
  width: 100%
}
</style>
