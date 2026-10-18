namespace DentalClinic.Domain.Dental;

public enum RootCanalStage { AccessOpening = 1, WorkingLength = 2, CleaningAndShaping = 3, Obturation = 4, FinalRestoration = 5, Completed = 6, PostAndCore = 7, Crown = 8 }

public enum ExaminationStatus { Draft = 1, Completed = 2 }

public enum DentalFindingType
{
    Healthy = 1, Caries = 2, Fracture = 3, Missing = 4,
    Sensitivity = 5, Infection = 6, Other = 7, RootCanal = 8, Crown = 9, RootCanalAndCrown = 10, RootCanalPostAndCrown = 11, ScalingAndPolishing = 12, Whitening = 13, Extraction = 14, Implant = 15, Orthodontics = 16, RootCanalPostAndFilling = 17
}

public enum DentalProcedureType
{
    Filling = 1, Extraction = 2, Implant = 3,
    RootCanal = 4, Crown = 5, Other = 6
}

public enum ToothSurface
{
    WholeTooth = 1, Mesial = 2, Distal = 3, Occlusal = 4,
    Buccal = 5, Lingual = 6, Palatal = 7, Incisal = 8,
    Cervical = 9, Root = 10
}
