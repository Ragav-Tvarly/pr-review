export const OPEN_PULL_REQUESTS = /* GraphQL */ `
  query OpenPullRequests($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      pullRequests(states: OPEN, first: 50, orderBy: { field: UPDATED_AT, direction: DESC }) {
        nodes {
          id
          number
          title
          url
          isDraft
          updatedAt
          additions
          deletions
          changedFiles
          reviewDecision
          baseRefName
          headRefName
          author { login avatarUrl }
          labels(first: 20) { nodes { name color } }
          reviewRequests(first: 10) {
            nodes { requestedReviewer { ... on User { login } } }
          }
          latestReviews(first: 10) { nodes { author { login } state } }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        }
      }
    }
  }
`;

export const PULL_REQUEST = /* GraphQL */ `
  query PullRequest($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      mergeCommitAllowed
      squashMergeAllowed
      rebaseMergeAllowed
      pullRequest(number: $number) {
        id
        number
        title
        url
        bodyHTML
        isDraft
        state
        createdAt
        updatedAt
        additions
        deletions
        changedFiles
        reviewDecision
        mergeable
        mergeStateStatus
        viewerCanUpdate
        headRefOid
        baseRefName
        headRefName
        author { login avatarUrl }
        labels(first: 20) { nodes { name color } }
        reviewRequests(first: 10) {
          nodes { requestedReviewer { ... on User { login } } }
        }
        latestReviews(first: 10) { nodes { author { login avatarUrl } state submittedAt url } }
        files(first: 100) {
          totalCount
          pageInfo { hasNextPage endCursor }
          nodes { path additions deletions changeType viewerViewedState }
        }
        comments(last: 100) { totalCount nodes { databaseId author { login avatarUrl } body bodyHTML createdAt url } }
        # checks of the head commit (commits(first: 100) below stops at 100, so its last item is not the head on big PRs)
        headCommit: commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 100) {
                  nodes {
                    ... on CheckRun { name conclusion status detailsUrl }
                    ... on StatusContext { context state targetUrl }
                  }
                }
              }
            }
          }
        }
        reviews(last: 30) {
          nodes {
            databaseId author { login avatarUrl } state bodyHTML submittedAt url
            comments(first: 50) { nodes { databaseId path line originalLine bodyHTML url replyTo { databaseId } } }
          }
        }
        commits(first: 100) {
          totalCount
          nodes {
            commit {
              oid
              abbreviatedOid
              messageHeadline
              messageBody
              committedDate
              url
              author { name user { login avatarUrl } }
            }
          }
        }
      }
    }
  }
`;

export const PULL_REQUEST_FILES_PAGE = /* GraphQL */ `
  query PullRequestFiles($owner: String!, $name: String!, $number: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        files(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { path additions deletions changeType viewerViewedState }
        }
      }
    }
  }
`;
