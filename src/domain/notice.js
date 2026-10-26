// Transient feedback stays separate from actionable, persistent form errors.
export function actionNotice(scope, method, params = {}) {
  if (scope === 'social') return ({
    block: params.blocked ? 'p2.blocked' : 'p2.unblocked',
    readEvents: 'toast.lightsRead', accept: 'toast.connected', ignore: 'toast.requestDeclined',
    preferences: 's.filterSaved', report: 'p2.reportSaved', request: 's.requestSaved',
  })[method] || ''
  return ({saveProfile: 'toast.profileUpdated', savePreferences: 'toast.themeUpdated',
    saveCollection: 'p2.collectionSaved', collectionPosts: 'p2.collectionSaved',
    submitFeedback: 'p5.feedbackSaved', deletePost: 'p5.postDeleted', deleteCollection: 'p5.collectionDeleted',
  })[method] || ''
}

export function noticePresentation(key) {
  const caution = ['p5.notification_unsupported', 'p4.callClosedSaveFailed', 'p5.cleanupPending']
  const information = ['resent', 'p2.draftSaved', 'p4.controlsAfterConnected']
  return {tone: caution.includes(key) ? 'attention' : information.includes(key) ? 'info' : 'success',
    position: ['p5.accountDeleted', 'p5.cleanupPending'].includes(key) ? 'center' : 'top'}
}

export function noticeDuration(text) {
  return Math.min(7500, Math.max(4200, 2400 + Array.from(text).length * 38))
}
