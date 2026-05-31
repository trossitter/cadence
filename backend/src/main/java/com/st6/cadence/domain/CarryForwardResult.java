package com.st6.cadence.domain;

public record CarryForwardResult(
    WeeklyCommitment closedCommitment, WeeklyCommitment carriedForwardCommitment) {}
