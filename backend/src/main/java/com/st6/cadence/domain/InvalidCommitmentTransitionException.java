package com.st6.cadence.domain;

public class InvalidCommitmentTransitionException extends RuntimeException {
  public InvalidCommitmentTransitionException(CommitmentStatus from, CommitmentStatus to) {
    super("Cannot transition commitment from " + from + " to " + to);
  }

  public InvalidCommitmentTransitionException(String message) {
    super(message);
  }
}
