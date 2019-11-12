<template>
  <tr>
    <td v-for='(day,index) in week' class="cal-day" :key='day.format("YYYY-MM-DD")'
        :class="isToday(day)?'today':inCurrentMonth(day)?'current-month':'extra-month'"
    >{{shortDate(day)}}
      <div v-if='assignment_info.length>0'>
        <draggable v-model='assignment_info[index]' group='calendar' class='assignments'
            @start='drag=true' @end='drag=false' @change='assignChange(day,$event)'>
          <div v-for='assignment in assignment_info[index]' :key='assignment.id'
            :class='assignment.type' class='assign border rounded border-dark pl-1 p-0'>{{assignment.set_id}}</div>
        </draggable>
      </div>
    </td>
  </tr>
</template>

<script lang='ts'>
import Draggable, {MoveEvent} from 'vuedraggable';
import * as moment from 'moment';
import Constants from '@/Constants';

import { Vue, Component, Watch, Prop } from 'vue-property-decorator';

// set up the store
import { getModule } from 'vuex-module-decorators';
import WeBWorKStore from '@/store';
const store = getModule(WeBWorKStore);

import ProblemSetList from '@/models/ProblemSetList';

interface AssignmentInfo {
  date: moment.Moment;
  type: string;
  set_id: string;
}

@Component({
  name: 'CalendarRow',
  components: {
    Draggable,
  },
})

export default class CalendarRow extends Vue {

  @Prop({ type: Object, validator: moment.isMoment })
  public readonly first_day_of_week!: moment.Moment;
  @Prop({type: ProblemSetList})
  public readonly problem_sets!: ProblemSetList;

  private today: moment.Moment = moment.default();
  private items: AssignmentInfo[][] = [];

  // interface assign_info = {date: moment.Moment, type: string, set_id: string};


  get week(): moment.Moment[] {
    return [0, 1, 2, 3, 4, 5, 6].map((i: number) => moment.default(this.first_day_of_week).add(i, 'days'));
  }

  get assignment_info() {
    if (this.problem_sets.size() > 0) {
      return this.week.map( (day: moment.Moment) => this.assignmentOnDate(day));
    } else {
      return [[], [], [], [], [], [], []];
    }
  }

  private shortDate(day: moment.Moment): string {
    return day.get('date') === 1 ? day.format('MMM D') : day.get('date').toString();
  }

  private inCurrentMonth(day: moment.Moment): boolean {
    return day.get('month') === this.today.get('month');
  }

  private isToday(day: moment.Moment): boolean {
    return this.onSameDay(day, this.today);
  }


  private assignmentOnDate(day: moment.Moment): AssignmentInfo[] {
    const _sets = this.problem_sets || [];
    const allDates = _sets.models().flatMap( (_set) => [
        {date: moment.unix(_set.get('answer_date')), type: 'answer', set_id: _set.get('set_id')},
        {date: moment.unix(_set.get('due_date')), type: 'due', set_id: _set.get('set_id')},
        {date: moment.unix(_set.get('reduced_scoring_date')), type: 'reduced', set_id: _set.get('set_id')},
        {date: moment.unix(_set.get('open_date')), type: 'open', set_id: _set.get('set_id')}]).
          map( (d) => Object.assign(d, {id: d.set_id + '___' + d.type}) );
    return allDates.filter( (_date: AssignmentInfo) => this.onSameDay(_date.date, day));
  }

  private onSameDay(day1: moment.Moment, day2: moment.Moment): boolean {
    return day1.get('date') === day2.get('date') && day1.get('month') === day2.get('month') &&
                            day1.get('year') === day2.get('year');
  }

  private assignChange(newDate: moment.Moment, evt: MoveEvent<any>) {
    if (evt.hasOwnProperty('added')) {
      const d = moment.default(newDate);

      // adjust the time to be the same as the previous assignment time.
      d.hours(evt.added.element.date.hours());
      d.minutes(evt.added.element.date.minutes());
      // const _set = this.problem_sets.get(evt.added.element.set_id);
      // _set.set(evt.added.element.type + '_date', d.unix());
      const attrs: {[key: string]: any} = {};
      attrs[evt.added.element.type + '_date'] = d.unix;
      const _set = this.problem_sets.get(evt.added.element.set_id);
      _set.set(attrs);
      store.updateProblemSet(_set);
    }
  }


}
</script>

<style scoped>
  .cal-day {height: 100px; width: 14.3%}
  .current-month {background: lightyellow}
  .extra-month {background: aliceblue}
  .today {background: lightpink}
  .open {background: lightgreen}
  .reduced {background-color: orange}
  .answer {background-color: lightblue}
  .due {background-color: red}
  .assign {font-size: 80%; cursor: move}
  .assignments {min-height: 50px}
  .nestable-item {margin-left: 0px}
  ol.nestable-list {list-style-type: none; padding-left: 5px}
</style>
