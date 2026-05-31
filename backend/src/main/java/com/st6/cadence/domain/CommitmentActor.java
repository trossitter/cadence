package com.st6.cadence.domain;

public record CommitmentActor(String subject, String name, boolean manager) {
  public CommitmentActor {
    if (subject == null || subject.isBlank()) {
      throw new IllegalArgumentException("Actor subject is required");
    }
    if (name == null || name.isBlank()) {
      name = subject;
    }
  }

  boolean owns(WeeklyCommitment commitment) {
    return subject.equals(commitment.getOwnerSubject());
  }
}
