using OrganizedJihad.Api.Models;
using OrganizedJihad.Data.Models;

namespace OrganizedJihad.Api.Services.TeamRecommendation;

/// <summary>
/// Shared Team Recommendation scoring helpers extracted from SyncService.
/// </summary>
internal static class TeamRecommendationScoringMath {
	/// <summary>
	/// Builds recommendation cards for synthetic roster-driven mode coverage.
	/// </summary>
	public static List<TeamRecommendationCard> BuildSyntheticRecommendationCards(
		string mode,
		string objective,
		TeamRecommendationScoringProfile profile,
		double externalModeWeight,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals,
		double resourcePressure,
		double calibrationScale,
		IReadOnlyList<Hero> heroes,
		IReadOnlyList<Titan> titans,
		int limit
	) {
		var cards = new List<TeamRecommendationCard>();
		if (limit <= 0) {
			return cards;
		}

		var normalizedObjective = NormalizeObjective(objective);

		if (mode == "cow") {
			var rankedTitans = titans
				.OrderByDescending(t =>
					(t.Power / 120000d) +
					(ComputeTitanMaturityScore(t) * 0.75d) +
					(normalizedObjective == "offense" ? (t.SkillLevel / 120d) * 0.25d : 0d) +
					(normalizedObjective is "defense" or "sustain" ? (t.Stars / 6d) * 0.20d : 0d))
				.ToList();

			var primaryTitans = rankedTitans.Take(5).ToList();
			if (primaryTitans.Count > 0) {
				var titanReadiness = ComputeTeamReadinessFromTitans(primaryTitans);
				var titanDepth = Math.Clamp((double)rankedTitans.Count / 10d, 0d, 1d);
				var titanConfidence = Math.Clamp(0.42 + (titanDepth * 0.24), 0d, 1d);
				var titanWin = normalizedObjective switch {
					"offense" => 0.66,
					"defense" => 0.59,
					"speed" => 0.63,
					"sustain" => 0.61,
					_ => 0.62,
				};

				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(", ", primaryTitans.Select(t => t.TitanName).Where(n => !string.IsNullOrWhiteSpace(n))),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: titanWin,
					readiness: titanReadiness,
					confidence: titanConfidence,
					sourceScale: 0.88,
					rationale: $"CoW titan lineup ranked for {normalizedObjective} using titan power, maturity, and roster depth.",
					source: "synthetic"
				));
			}

			var reserveTitans = rankedTitans.Skip(3).Take(5).ToList();
			if (reserveTitans.Count == 5) {
				var reserveReadiness = ComputeTeamReadinessFromTitans(reserveTitans);
				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(", ", reserveTitans.Select(t => t.TitanName).Where(n => !string.IsNullOrWhiteSpace(n))),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: 0.56,
					readiness: reserveReadiness,
					confidence: 0.44,
					sourceScale: 0.82,
					rationale: "CoW reserve titan lineup for rotation or counter-slot coverage.",
					source: "synthetic"
				));
			}
		}

		var rankedHeroes = RankHeroesForModeAndObjective(heroes, mode, normalizedObjective).ToList();
		if (rankedHeroes.Count == 0) {
			return cards;
		}

		if (mode == "grandarena") {
			var teamA = rankedHeroes.Take(5).ToList();
			var teamB = rankedHeroes.Skip(5).Take(5).ToList();
			var teamC = rankedHeroes.Skip(10).Take(5).ToList();

			var teams = new[] { teamA, teamB, teamC }
				.Where(t => t.Count > 0)
				.Select(t => string.Join(", ", t.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))))
				.Where(t => !string.IsNullOrWhiteSpace(t))
				.ToList();

			if (teams.Count > 0) {
				var draftPool = rankedHeroes.Take(15).ToList();
				var readiness = ComputeTeamReadinessFromHeroes(draftPool);
				var depth = Math.Clamp((double)rankedHeroes.Count / 15d, 0d, 1d);
				var confidence = Math.Clamp(0.36 + (depth * 0.28), 0d, 1d);
				var win = normalizedObjective switch {
					"offense" => 0.62,
					"defense" => 0.57,
					"speed" => 0.60,
					"sustain" => 0.58,
					_ => 0.59,
				};

				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(" | ", teams),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: win,
					readiness: readiness,
					confidence: confidence,
					sourceScale: 0.84,
					rationale: $"Grand Arena squads assembled for {normalizedObjective} with roster depth-aware confidence.",
					source: "synthetic"
				));
			}
		}

		var primaryTeam = rankedHeroes.Take(5).ToList();
		if (primaryTeam.Count > 0) {
			var readiness = ComputeTeamReadinessFromHeroes(primaryTeam);
			var primaryWin = (mode, normalizedObjective) switch {
				("campaign", "offense") => 0.72,
				("campaign", "sustain") => 0.68,
				("campaign", _) => 0.70,
				("adventure", "offense") => 0.68,
				("adventure", "sustain") => 0.69,
				("adventure", _) => 0.66,
				("dungeon", "offense") => 0.67,
				("dungeon", "sustain") => 0.70,
				("dungeon", _) => 0.66,
				("guildwar", "defense") => 0.61,
				("guildwar", "offense") => 0.60,
				("guildwar", _) => 0.57,
				("toe", "offense") => 0.61,
				("toe", "defense") => 0.60,
				("toe", _) => 0.58,
				("arena", "offense") => 0.64,
				("arena", "speed") => 0.63,
				("arena", _) => 0.62,
				_ => 0.61,
			};
			var depth = Math.Clamp((double)rankedHeroes.Count / (mode == "grandarena" ? 15d : 10d), 0d, 1d);
			var primaryConfidence = Math.Clamp(0.34 + (depth * 0.30), 0d, 1d);

			cards.Add(CreateSyntheticCard(
				teamPreview: string.Join(", ", primaryTeam.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))),
				mode: mode,
				objective: normalizedObjective,
				profile: profile,
				externalModeWeight: externalModeWeight,
				externalSignals: externalSignals,
				resourcePressure: resourcePressure,
				calibrationScale: calibrationScale,
				winProbability: primaryWin,
				readiness: readiness,
				confidence: primaryConfidence,
				sourceScale: 0.78,
				rationale: $"{mode} primary lineup tuned for {normalizedObjective} using weighted roster maturity.",
				source: "synthetic"
			));
		}

		var secondaryTeam = rankedHeroes.Skip(mode == "campaign" ? 2 : 4).Take(5).ToList();
		if (secondaryTeam.Count > 0) {
			var secondaryReadiness = ComputeTeamReadinessFromHeroes(secondaryTeam);
			var secondaryWin = (mode, normalizedObjective) switch {
				("guildwar", "defense") => 0.58,
				("campaign", "sustain") => 0.60,
				("adventure", "sustain") => 0.59,
				("dungeon", "sustain") => 0.60,
				("toe", "defense") => 0.57,
				("arena", "speed") => 0.56,
				_ => 0.55,
			};

			cards.Add(CreateSyntheticCard(
				teamPreview: string.Join(", ", secondaryTeam.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))),
				mode: mode,
				objective: normalizedObjective,
				profile: profile,
				externalModeWeight: externalModeWeight,
				externalSignals: externalSignals,
				resourcePressure: resourcePressure,
				calibrationScale: calibrationScale,
				winProbability: secondaryWin,
				readiness: secondaryReadiness,
				confidence: 0.40,
				sourceScale: 0.72,
				rationale: $"{mode} alternate lineup to preserve the main core while covering {normalizedObjective} fallback scenarios.",
				source: "synthetic"
			));
		}

		if (mode is "guildwar" or "campaign" or "adventure" or "dungeon" or "toe") {
			var sustainRanked = RankHeroesForModeAndObjective(heroes, mode, "sustain").Take(5).ToList();
			if (sustainRanked.Count == 5) {
				cards.Add(CreateSyntheticCard(
					teamPreview: string.Join(", ", sustainRanked.Select(h => h.HeroName).Where(n => !string.IsNullOrWhiteSpace(n))),
					mode: mode,
					objective: normalizedObjective,
					profile: profile,
					externalModeWeight: externalModeWeight,
					externalSignals: externalSignals,
					resourcePressure: resourcePressure,
					calibrationScale: calibrationScale,
					winProbability: mode switch {
						"guildwar" => 0.56,
						"toe" => 0.58,
						_ => 0.63,
					},
					readiness: ComputeTeamReadinessFromHeroes(sustainRanked),
					confidence: 0.47,
					sourceScale: 0.74,
					rationale: $"{mode} sustain-leaning lineup for long-fight stability and attrition resilience.",
					source: "synthetic"
				));
			}
		}

		return cards.Take(limit).ToList();
	}

	/// <summary>
	/// Builds provenance records for recommendation cards.
	/// </summary>
	public static List<TeamRecommendationProvenance> BuildProvenance(
		string sourceType,
		TeamRecommendationScoringProfile profile,
		double winProbability,
		double readiness,
		double confidence,
		double baseScore,
		double frictionAdjustedScore,
		double finalScore,
		double sourceScale,
		double frictionPenalty,
		double resourcePressure,
		double calibrationScale,
		double externalModeWeight,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals
	) {
		var records = new List<TeamRecommendationProvenance> {
			new TeamRecommendationProvenance {
				SourceType = "profile",
				SourceName = profile.ProfileName,
				Confidence = 1d,
				Detail = $"Weights => win {profile.WinWeight:F2}, readiness {profile.ReadinessWeight:F2}, confidence {profile.ConfidenceWeight:F2}.",
				Contribution = new TeamRecommendationContribution {
					WinWeight = Math.Round(profile.WinWeight, 6),
					ReadinessWeight = Math.Round(profile.ReadinessWeight, 6),
					ConfidenceWeight = Math.Round(profile.ConfidenceWeight, 6),
				},
			},
			new TeamRecommendationProvenance {
				SourceType = sourceType,
				SourceName = sourceType switch {
					"history" => "Historical battle outcomes",
					"simulator" => "Monte Carlo simulator",
					_ => "Current roster state",
				},
				Confidence = Math.Clamp(confidence, 0d, 1d),
				Detail = $"Components => win {winProbability:F2}, readiness {readiness:F2}, confidence {confidence:F2}; score {baseScore:F3} -> {frictionAdjustedScore:F3} -> {finalScore:F3} (friction {frictionPenalty:F3}, pressure {resourcePressure:F2}).",
				Contribution = new TeamRecommendationContribution {
					WinProbability = Math.Round(Math.Clamp(winProbability, 0d, 1d), 6),
					Readiness = Math.Round(Math.Clamp(readiness, 0d, 1d), 6),
					Confidence = Math.Round(Math.Clamp(confidence, 0d, 1d), 6),
					WinWeight = Math.Round(profile.WinWeight, 6),
					ReadinessWeight = Math.Round(profile.ReadinessWeight, 6),
					ConfidenceWeight = Math.Round(profile.ConfidenceWeight, 6),
					BaseScore = Math.Round(Math.Clamp(baseScore, 0d, 1d), 6),
					FrictionPenalty = Math.Round(Math.Clamp(frictionPenalty, 0d, 1d), 6),
					ResourcePressure = Math.Round(Math.Clamp(resourcePressure, 0d, 1d), 6),
					CalibrationScale = Math.Round(Math.Clamp(calibrationScale, 0.65d, 1.45d), 6),
					FinalScore = Math.Round(Math.Clamp(finalScore, 0d, 1d), 6),
					ExternalBonus = Math.Round(Math.Max(0d, finalScore - frictionAdjustedScore), 6),
					SourceScale = Math.Round(Math.Clamp(sourceScale, 0d, 1d), 6),
					ExternalModeWeight = Math.Round(Math.Clamp(externalModeWeight, 0d, 1d), 6),
				},
			}
		};

		var topSignals = externalSignals.Take(3).ToList();
		var normalizedSourceScale = Math.Clamp(sourceScale, 0d, 1d);
		var normalizedModeWeight = Math.Clamp(externalModeWeight, 0d, 1d);
		var normalizedResourcePressure = Math.Clamp(resourcePressure, 0d, 1d);
		var normalizedFrictionPenalty = Math.Clamp(frictionPenalty, 0d, 1d);
		var normalizedCalibrationScale = Math.Clamp(calibrationScale, 0.65d, 1.45d);
		var perSignalBonusDenominator = topSignals.Count == 0
			? 1d
			: topSignals.Sum(signal => Math.Clamp(signal.Confidence, 0d, 1d));

		records.AddRange(topSignals.Select(signal => {
			var normalizedSignalConfidence = Math.Clamp(signal.Confidence, 0d, 1d);
			var signalRatio = perSignalBonusDenominator <= 0d
				? 0d
				: normalizedSignalConfidence / perSignalBonusDenominator;
			var signalBonus = Math.Max(0d, finalScore - frictionAdjustedScore) * signalRatio;

			return new TeamRecommendationProvenance {
				SourceType = signal.SourceType,
				SourceName = signal.SourceName,
				SourceUrl = signal.SourceUrl,
				Confidence = normalizedSignalConfidence,
				Detail = $"{signal.Detail} Mode external weight {externalModeWeight:F2}.",
				Contribution = new TeamRecommendationContribution {
					SourceConfidence = Math.Round(normalizedSignalConfidence, 6),
					ExternalModeWeight = Math.Round(normalizedModeWeight, 6),
					SourceScale = Math.Round(normalizedSourceScale, 6),
					FrictionPenalty = Math.Round(normalizedFrictionPenalty, 6),
					ResourcePressure = Math.Round(normalizedResourcePressure, 6),
					CalibrationScale = Math.Round(normalizedCalibrationScale, 6),
					ExternalBonus = Math.Round(signalBonus, 6),
					BaseScore = Math.Round(Math.Clamp(baseScore, 0d, 1d), 6),
					FinalScore = Math.Round(Math.Clamp(finalScore, 0d, 1d), 6),
				},
			};
		}));

		return records;
	}

	/// <summary>
	/// Applies external-signal confidence bonus to a recommendation score.
	/// </summary>
	public static double ApplyExternalSignalBonus(
		double baseScore,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals,
		double modeWeight,
		double sourceScale
	) {
		if (externalSignals.Count == 0 || modeWeight <= 0d) {
			return Math.Clamp(baseScore, 0d, 1d);
		}

		var aggregate = externalSignals
			.Take(3)
			.Average(signal => Math.Clamp(signal.Confidence, 0d, 1d));

		var bonus = aggregate * Math.Clamp(modeWeight, 0d, 1d) * Math.Clamp(sourceScale, 0d, 1d);
		return Math.Clamp(baseScore + bonus, 0d, 1d);
	}

	/// <summary>
	/// Computes recommendation score from weighted profile components.
	/// </summary>
	public static double ComputeFinalTeamScore(double winProbability, double readiness, double confidence, TeamRecommendationScoringProfile profile) {
		return Math.Clamp(
			(winProbability * profile.WinWeight) +
			(readiness * profile.ReadinessWeight) +
			(confidence * profile.ConfidenceWeight),
			0d,
			1d
		);
	}

	/// <summary>
	/// Calculates friction penalty from roster pressure and context multipliers.
	/// </summary>
	public static double ComputeRosterFrictionPenalty(
		double resourcePressure,
		double readiness,
		string mode,
		string objective,
		double sourceScale,
		double calibrationScale
	) {
		var normalizedPressure = Math.Clamp(resourcePressure, 0d, 1d);
		var normalizedReadiness = Math.Clamp(readiness, 0d, 1d);
		var normalizedScale = Math.Clamp(sourceScale, 0d, 1d);

		var modeMultiplier = mode switch {
			"campaign" => 0.78,
			"adventure" => 0.82,
			"dungeon" => 0.80,
			"guildwar" => 0.95,
			"toe" => 0.93,
			"cow" => 0.92,
			"grandarena" => 1.00,
			_ => 0.90,
		};

		var objectiveMultiplier = objective switch {
			"offense" => 1.08,
			"speed" => 1.04,
			"defense" => 0.96,
			"sustain" => 0.93,
			_ => 1.00,
		};

		var readinessRelief = 1d - (normalizedReadiness * 0.72d);
		var normalizedCalibrationScale = Math.Clamp(calibrationScale, 0.65d, 1.45d);
		var penalty = normalizedPressure * readinessRelief * modeMultiplier * objectiveMultiplier * normalizedCalibrationScale * (0.06d + (normalizedScale * 0.14d));
		return Math.Clamp(penalty, 0d, 0.30d);
	}

	/// <summary>
	/// Computes resource-pressure score from latest snapshot/inventory data.
	/// </summary>
	public static double ComputeResourcePressureScore(PlayerSnapshot? snapshot, InventorySnapshot? inventory) {
		var goldPressure = 1d - Math.Clamp((snapshot?.Gold ?? 0L) / 2_500_000d, 0d, 1d);
		var emeraldPressure = 1d - Math.Clamp((snapshot?.Emeralds ?? 0) / 3_500d, 0d, 1d);
		var consumablePressure = 1d - Math.Clamp((inventory?.TotalConsumables ?? 0) / 900d, 0d, 1d);
		var evolutionPressure = 1d - Math.Clamp((inventory?.TotalEvolutionItems ?? 0) / 750d, 0d, 1d);
		var heroSoulPressure = 1d - Math.Clamp((inventory?.TotalHeroSoulStones ?? 0) / 1500d, 0d, 1d);
		var titanSoulPressure = 1d - Math.Clamp((inventory?.TotalTitanSoulStones ?? 0) / 800d, 0d, 1d);

		var weighted =
			(goldPressure * 0.22d) +
			(emeraldPressure * 0.24d) +
			(consumablePressure * 0.14d) +
			(evolutionPressure * 0.14d) +
			(heroSoulPressure * 0.14d) +
			(titanSoulPressure * 0.12d);

		return Math.Clamp(weighted, 0d, 1d);
	}

	/// <summary>
	/// Computes readiness estimate from team-preview names and available roster names.
	/// </summary>
	public static double ComputeReadinessFromTeamPreview(string? teamPreview, HashSet<string> availableNames) {
		if (string.IsNullOrWhiteSpace(teamPreview) || availableNames.Count == 0) {
			return 0.5;
		}

		var tokens = teamPreview
			.Split([',', '|', ';', '/'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
			.Where(t => !string.IsNullOrWhiteSpace(t))
			.ToList();

		if (tokens.Count == 0) {
			return 0.5;
		}

		var matches = tokens.Count(t => availableNames.Contains(t));
		return Math.Clamp((double)matches / tokens.Count, 0d, 1d);
	}

	/// <summary>
	/// Normalizes a recommendation team preview for robust matching.
	/// </summary>
	public static string NormalizeTeamSignature(string? teamPreview) {
		if (string.IsNullOrWhiteSpace(teamPreview)) {
			return string.Empty;
		}

		var canonical = teamPreview
			.Trim()
			.Replace(" | ", ",", StringComparison.Ordinal)
			.Replace("|", ",", StringComparison.Ordinal)
			.Replace(";", ",", StringComparison.Ordinal)
			.Replace("/", ",", StringComparison.Ordinal)
			.Replace(" ", string.Empty, StringComparison.Ordinal)
			.ToLowerInvariant();

		while (canonical.Contains(",,")) {
			canonical = canonical.Replace(",,", ",", StringComparison.Ordinal);
		}

		return canonical.Trim(',');
	}

	/// <summary>
	/// Builds a safe short team preview string from a team key.
	/// </summary>
	public static string BuildTeamPreview(string teamKey) {
		if (string.IsNullOrWhiteSpace(teamKey)) {
			return "Unknown team";
		}

		var compact = teamKey.Replace("\r", string.Empty).Replace("\n", string.Empty);
		return compact.Length <= 180
			? compact
			: $"{compact[..177]}...";
	}

	private static TeamRecommendationCard CreateSyntheticCard(
		string teamPreview,
		string mode,
		string objective,
		TeamRecommendationScoringProfile profile,
		double externalModeWeight,
		IReadOnlyList<ExternalRecommendationSignal> externalSignals,
		double resourcePressure,
		double calibrationScale,
		double winProbability,
		double readiness,
		double confidence,
		double sourceScale,
		string rationale,
		string source
	) {
		var normalizedWin = Math.Clamp(winProbability, 0d, 1d);
		var normalizedReadiness = Math.Clamp(readiness, 0d, 1d);
		var normalizedConfidence = Math.Clamp(confidence, 0d, 1d);
		var baseScore = ComputeFinalTeamScore(normalizedWin, normalizedReadiness, normalizedConfidence, profile);
		var frictionPenalty = ComputeRosterFrictionPenalty(resourcePressure, normalizedReadiness, mode, objective, sourceScale, calibrationScale);
		var frictionAdjustedScore = Math.Clamp(baseScore - frictionPenalty, 0d, 1d);
		var finalScore = ApplyExternalSignalBonus(frictionAdjustedScore, externalSignals, externalModeWeight, sourceScale);

		return new TeamRecommendationCard {
			Source = source,
			TeamPreview = teamPreview,
			ContextTag = objective,
			ModeProfile = profile.ProfileName,
			EstimatedWinProbability = normalizedWin,
			ReadinessScore = normalizedReadiness,
			ConfidenceScore = normalizedConfidence,
			FinalScore = finalScore,
			Rationale = $"{rationale} Resource friction penalty {(frictionPenalty * 100):F1}%.",
			Provenance = BuildProvenance("roster", profile, normalizedWin, normalizedReadiness, normalizedConfidence, baseScore, frictionAdjustedScore, finalScore, sourceScale, frictionPenalty, resourcePressure, calibrationScale, externalModeWeight, externalSignals),
		};
	}

	private static IReadOnlyList<Hero> RankHeroesForModeAndObjective(
		IReadOnlyList<Hero> heroes,
		string mode,
		string objective
	) {
		var normalizedMode = NormalizeMode(mode);
		var normalizedObjective = NormalizeObjective(objective);

		return heroes
			.Where(h => !string.IsNullOrWhiteSpace(h.HeroName))
			.OrderByDescending(hero => {
				var maturity = ComputeHeroMaturityScore(hero);
				var basePower = Math.Clamp(hero.Power / 140000d, 0d, 1.2d);
				var objectiveBias = normalizedObjective switch {
					"offense" => ((hero.Power / 140000d) * 0.45d) + ((hero.SkillLevel1 + hero.SkillLevel2 + hero.SkillLevel3 + hero.SkillLevel4) / 600d) * 0.20d,
					"defense" => ((hero.Color / 20d) * 0.35d) + ((hero.Stars / 6d) * 0.20d),
					"speed" => ((hero.Level / 130d) * 0.35d) + ((hero.SkillLevel1 / 150d) * 0.20d),
					"sustain" => ((hero.Stars / 6d) * 0.35d) + ((hero.ArtifactBook + hero.ArtifactRing) / 12d) * 0.22d,
					_ => (hero.Power / 140000d) * 0.30d,
				};

				var modeBias = normalizedMode switch {
					"campaign" => ((hero.Level / 130d) * 0.14d) + ((hero.Stars / 6d) * 0.06d),
					"adventure" => ((hero.Color / 20d) * 0.10d) + ((hero.Stars / 6d) * 0.08d),
					"dungeon" => ((hero.Level / 130d) * 0.10d) + ((hero.Stars / 6d) * 0.10d),
					"guildwar" => ((hero.Power / 140000d) * 0.08d) + ((hero.Color / 20d) * 0.08d),
					"toe" => ((hero.Power / 140000d) * 0.10d) + ((hero.SkillLevel1 / 150d) * 0.07d),
					"grandarena" => ((hero.Power / 140000d) * 0.06d) + ((hero.Stars / 6d) * 0.08d),
					_ => 0d,
				};

				return basePower + (maturity * 0.60d) + objectiveBias + modeBias;
			})
			.ThenByDescending(h => h.Power)
			.ThenByDescending(h => h.Color)
			.ThenByDescending(h => h.Stars)
			.ToList();
	}

	private static double ComputeHeroMaturityScore(Hero hero) {
		if (hero is null) {
			return 0d;
		}

		var levelScore = Math.Clamp(hero.Level / 130d, 0d, 1d);
		var starScore = Math.Clamp(hero.Stars / 6d, 0d, 1d);
		var colorScore = Math.Clamp(hero.Color / 20d, 0d, 1d);
		var artifactScore = Math.Clamp((hero.ArtifactWeapon + hero.ArtifactBook + hero.ArtifactRing) / 18d, 0d, 1d);
		return Math.Clamp((levelScore * 0.30d) + (starScore * 0.25d) + (colorScore * 0.25d) + (artifactScore * 0.20d), 0d, 1d);
	}

	private static double ComputeTitanMaturityScore(Titan titan) {
		if (titan is null) {
			return 0d;
		}

		var levelScore = Math.Clamp(titan.Level / 120d, 0d, 1d);
		var starScore = Math.Clamp(titan.Stars / 6d, 0d, 1d);
		var summonScore = Math.Clamp(titan.SummonStars / 6d, 0d, 1d);
		var skinScore = Math.Clamp(titan.SkinLevel / 60d, 0d, 1d);
		return Math.Clamp((levelScore * 0.30d) + (starScore * 0.28d) + (summonScore * 0.22d) + (skinScore * 0.20d), 0d, 1d);
	}

	private static double ComputeTeamReadinessFromHeroes(IReadOnlyList<Hero> team) {
		if (team.Count == 0) {
			return 0d;
		}

		return Math.Clamp(team.Average(ComputeHeroMaturityScore), 0d, 1d);
	}

	private static double ComputeTeamReadinessFromTitans(IReadOnlyList<Titan> team) {
		if (team.Count == 0) {
			return 0d;
		}

		return Math.Clamp(team.Average(ComputeTitanMaturityScore), 0d, 1d);
	}

	private static string NormalizeMode(string? mode) {
		return TeamRecommendationModeNormalization.NormalizeMode(mode);
	}

	private static string NormalizeObjective(string? objective) {
		return TeamRecommendationModeNormalization.NormalizeObjective(objective);
	}
}
