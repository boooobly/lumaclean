import type {DurationConfig} from '@/lib/domain/duration';

/** Owner approval 2026-11-02. Data for prospective versions; never activates DB rules. */
export function approvedWebsiteDuration(service:'regular'|'deep',identity:{id:string;serviceId:string;version:number},reserveMinutes:number):DurationConfig{
  return{...identity,active:false,minArea:25,maxArea:120,cleanerCount:2,referenceArea:25,
    baseMinutes:service==='regular'?60:180,minutesPerSquare:service==='regular'?2.4:7.2,
    soilMultipliers:{NORMAL:1},extraMinutes:{},reserveMinutes,unknownExtraReserveMinutes:0};
}
