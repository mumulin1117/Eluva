<script setup>
import { computed,onBeforeUnmount,onMounted,ref,useId } from 'vue'
import '../home-landscape.css'

const props=defineProps({paused:Boolean})
const root=ref(null),hidden=ref(false),reduced=ref(false),obscured=ref(false),inView=ref(true)
// Keep the native cover/center-top mapping of the frozen 780 × 1688 map.
// Its trees and water are one raster: fixed, feathered masks move only the
// original texture inside those regions, leaving roads and coastlines still.
const prefix='home-landscape-'+useId().replace(/[^a-zA-Z0-9_-]/g,'')
const mask=id=>'url(#'+prefix+'-'+id+')'
const running=computed(()=>!props.paused&&!hidden.value&&!reduced.value&&!obscured.value&&inView.value)
let media,intersection,modalObserver
const visibility=()=>{hidden.value=document.visibilityState!=='visible'}
const reduceMotion=()=>{reduced.value=!!media?.matches}
onMounted(()=>{
 visibility();media=window.matchMedia('(prefers-reduced-motion: reduce)');reduceMotion()
 document.addEventListener('visibilitychange',visibility)
 media.addEventListener('change',reduceMotion)
 const app=document.getElementById('app')
 if(app){const sync=()=>{obscured.value=app.hasAttribute('inert')};sync();modalObserver=new MutationObserver(sync);modalObserver.observe(app,{attributes:true,attributeFilter:['inert']})}
 if('IntersectionObserver' in window){intersection=new IntersectionObserver(entries=>{inView.value=!!entries[0]?.isIntersecting});intersection.observe(root.value)}
})
onBeforeUnmount(()=>{
 document.removeEventListener('visibilitychange',visibility)
 media?.removeEventListener('change',reduceMotion)
 intersection?.disconnect();modalObserver?.disconnect()
})
</script>

<template>
 <div ref="root" class="home-landscape" :data-motion="reduced?'reduced':running?'running':'paused'" aria-hidden="true">
  <svg class="home-landscape-map" viewBox="0 0 780 1688" preserveAspectRatio="xMidYMin slice" focusable="false" aria-hidden="true">
   <defs>
    <image :id="prefix+'-map'" href="/images/p2/empty-background.png" width="780" height="1688"/>
    <filter :id="prefix+'-feather'" x="-4%" y="-4%" width="108%" height="108%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="3"/></filter>
    <mask :id="prefix+'-water'" maskUnits="userSpaceOnUse" x="0" y="0" width="780" height="1688" style="mask-type:luminance">
     <g fill="white" :filter="mask('feather')">
      <path d="M385 274C437 245 513 246 589 269L641 296L635 343L610 395C558 416 509 390 459 363L391 316Z"/>
      <path d="M18 649L52 668L61 700L99 713L104 743L91 775L67 818L31 850L10 846L12 793L29 752L9 716Z"/>
      <path d="M112 603L164 629L192 666L208 714L199 758L184 790L155 828L133 847L115 853L138 794L146 747L125 710L106 682L96 650Z"/>
      <path d="M380 1027L431 1001L461 1000L511 1027L559 1038L568 1054L530 1048L481 1066L451 1092L449 1125L400 1152L361 1172L338 1157L369 1123L343 1089Z"/>
      <path d="M661 698L704 680L740 682L762 697L766 717L741 711L714 718L692 734L670 722Z"/>
     </g>
    </mask>
    <mask :id="prefix+'-left-tree'" maskUnits="userSpaceOnUse" x="0" y="530" width="105" height="120" style="mask-type:luminance">
     <path d="M0 579L12 571L20 554L39 548L54 559L68 556L83 573L79 590L65 599L53 600L43 619L23 614L19 601L4 601Z" fill="white" :filter="mask('feather')"/>
    </mask>
    <mask :id="prefix+'-right-trees'" maskUnits="userSpaceOnUse" x="615" y="260" width="165" height="235" style="mask-type:luminance">
     <path d="M701 281L714 271L730 281L735 300L752 307L762 328L775 332L779 369L763 389L748 379L737 362L717 366L705 346L690 342L688 322Z" fill="white" :filter="mask('feather')"/>
     <path d="M668 361L683 353L698 369L714 365L721 387L739 397L749 427L735 446L715 442L706 459L682 469L663 457L641 467L630 449L639 431L633 410L649 398L646 378Z" fill="white" :filter="mask('feather')"/>
    </mask>
    <linearGradient :id="prefix+'-water-light'" x1="0" y1="0" x2="1" y2="1">
     <stop offset="0" stop-color="white" stop-opacity="0"/><stop offset=".35" stop-color="#d7fcff" stop-opacity=".12"/><stop offset=".5" stop-color="white" stop-opacity=".5"/><stop offset=".65" stop-color="#d7fcff" stop-opacity=".12"/><stop offset="1" stop-color="white" stop-opacity="0"/>
    </linearGradient>
   </defs>
   <g :mask="mask('water')">
    <use :href="'#'+prefix+'-map'" class="home-landscape-water"/>
    <rect class="home-landscape-water-light" x="0" y="0" width="780" height="1688" :fill="mask('water-light')"/>
   </g>
   <g :mask="mask('left-tree')"><use :href="'#'+prefix+'-map'" class="home-landscape-tree home-landscape-tree-left"/></g>
   <g :mask="mask('right-trees')"><use :href="'#'+prefix+'-map'" class="home-landscape-tree home-landscape-tree-right"/></g>
  </svg>
 </div>
</template>
