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
            nodes { requestedReviewer { ... on User { login } ... on Team { name } } }
          }
          latestReviews(first: 10) { nodes { author { login } state } }
          commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
        }
      }
    }
  }
`;
