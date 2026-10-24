<script setup>
defineProps({ name: String, size: { type: Number, default: 22 } })
const paths = {
  info:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 11v6M12 7v.1',
  warning:'M10.3 4a2 2 0 0 1 3.4 0l8 14a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3ZM12 9v4M12 17v.1',
  smile:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 9h.01M16 9h.01M8 14c2 4 6 4 8 0',image:'M3 3h18v18H3ZM3 16l6-6 4 4 3-2 5 5M15 7h.01',mic:'M8 5a4 4 0 1 1 8 0v6a4 4 0 0 1-8 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',video:'M3 6h12v12H3ZM15 10l6-3v10l-6-3',follow:'M3 21v-2a7 7 0 0 1 10-6M6 6a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM16 16h6M19 13v6',mail:'M2 5h20v14H2ZM2 5l10 8L22 5',
  light:'M9 18h6M10 21h4M8 15c-5-4-2-12 4-12s9 8 4 12l-1 2H9Z',
  play:'M8 4l13 8-13 8Z',pause:'M8 4v16M16 4v16',more:'M4 12h1m7 0h1m7 0h1',lock:'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4',
  help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.5 8a2.6 2.6 0 0 1 5 1c0 2-2.5 2-2.5 4M12 16.5v.1',
  expand:'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6',
  back: 'M15 5l-7 7 7 7', close: 'M6 6l12 12M18 6L6 18', check: 'M5 12l4 4L19 6',
  home: 'M3 11l9-8 9 8M5 9v11h5v-6h4v6h5V9',
  chats: 'M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z',
  user: 'M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  plus: 'M12 5v14M5 12h14', arrow: 'M5 12h14m-6-6 6 6-6 6',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12ZM9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z',
  eyeOff: 'M3 3l18 18M9 5.5A12 12 0 0 1 12 5c6 0 10 7 10 7a21 21 0 0 1-4 4M6 6a22 22 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1M10 10a3 3 0 0 0 4 4',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM9 21h6',
  camera: 'M3 7h4l2-3h6l2 3h4v14H3ZM8 13a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z',
  globe: 'M21 12a9 9 0 1 0-18 0 9 9 0 0 0 18 0ZM3 12h18M12 3c-5 5-5 13 0 18 5-5 5-13 0-18',
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.user" /></svg></template>
