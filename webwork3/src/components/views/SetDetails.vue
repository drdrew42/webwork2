<template>
    <b-container>
    <b-tabs content-class="mt-3">
      <b-tab title="Set Details" active>
        <set-info :problem_sets="problem_sets" :problem_set="problem_set"/></b-tab>
      <b-tab title="Problems"><problem-list-view :selected_set_id="selected_set_id"/></b-tab>
      <b-tab title="Assign Users Overrides">
        <assign-users :problem_set="problem_set"/></b-tab>
      <b-tab title="Set Headers"><set-headers :selected_set_id="selected_set_id"/></b-tab>
      <template slot="tabs">
        <b-nav-item href="#" @click="() => {}" id="custom-tab">
          <b-select size="sm" v-model="selected_set_id">
            <option :value="null" selected :disabled="true">Select a Set</option>
            <option v-for="set in problem_sets.models()" :value="set.get('set_id')" :key="set.get('set_id')">
                {{set.get('set_id')}}</option>
          </b-select>
        </b-nav-item>
      </template>
    </b-tabs>
  </b-container>
</template>



<script lang="ts">
import { Vue, Component, Watch, Prop } from 'vue-property-decorator';


import SetInfo from './SetDetailsComponents/SetInfo.vue';
import ProblemListView from './SetDetailsComponents/ProblemListView.vue';
import AssignUsers from './SetDetailsComponents/AssignUsers.vue';
import SetHeaders from './SetDetailsComponents/SetHeaders.vue';

import ProblemSet from '@/models/ProblemSet';
import ProblemSetList from '@/models/ProblemSetList';

// set up the store
import { getModule } from 'vuex-module-decorators';
import WeBWorKStore from '@/store';
const store = getModule(WeBWorKStore);


@Component({
  name: 'SetDetails',
  components: {
    SetInfo,
    ProblemListView,
    AssignUsers,
    SetHeaders,
  },
})
export default class SetDetails extends Vue {
  private selected_set_id: string = '';
  private problem_set!: ProblemSet;
  private data_loading: boolean = true;
  private validReducedScoring: boolean = true;
  private validDueDate: boolean = true;
  private validAnswerDate: boolean = true;

  // @Prop()
  // private problem_sets!: ProblemSetList;

  public mounted() {
    if (this.$route.query && this.$route.query.set_id) {
      this.selected_set_id = this.$route.query.set_id as string;
    }
    // tslint:disable-next-line
    console.log(this.problem_sets);
  }

  @Watch('selected_set_id')
  private selectedSetIdChanged(val: string, oldVal: string) {
    this.problem_set = this.problem_sets.get(this.selected_set_id);
  }

  @Watch('problem_sets')
  private problemSetsChanged(val: string, oldVal: string) {
    this.problem_set = this.problem_sets.get(this.selected_set_id);
  }

  @Watch('problem_set', {deep: true})
  private updateSet3(val: string, oldVal: string) {
    if (this.data_loading) {
      this.data_loading = false;
      return;
    }
    // validate the problem set update
  }

  get problem_sets() {
    return store.problem_sets;
  }

} // class SetDetails
</script>

<style scoped>
#custom-tab a {
   padding-top: 4px;
   padding-bottom: 4px
}
 </style>
