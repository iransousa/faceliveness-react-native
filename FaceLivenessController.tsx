import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useContext, useEffect, useState } from "react";
import {
  DeviceEventEmitter,
  NativeModules,
  Platform,
  PermissionsAndroid,
} from "react-native";
import {
  useGetFacelivenessResult,
  useUploadDocument,
  useGetFacelivenessId,
  useGetFacelivenessCredentials,
} from "./services/faceLiveness.actions";
import { ThemeContext } from "styled-components";
import { formatBytes } from "../../Utils";
import { useAuth } from "../../Store";
import {
  FaceLivenessComponent,
  FaceLivenessComponentMenuProps,
} from "./components/FaceLivenessDocument.component";
import { FaceLivenessPrepareComponent } from "./components/FaceLivenessPrepare.component";
import DocumentScanner, {
  ResponseType,
} from "react-native-document-scanner-plugin";
import { FaceLivenessResultComponent } from "./components/FaceLivenessResult.component";
import BlobUtil from "react-native-blob-util";
import { FeedbacksErrorSchema } from "../Feedbacks/FeedbacksError/FeedbacksError.schema";
type ParamList = {
  FaceLiveness: {
    success?: boolean;
    clear?: boolean;
  };
};

type DocumentProps = {
  uri?: string;
  data?: string;
  size?: string;
  file_name?: string;
  mime_type?: string;
};

export const FaceLivenessController: React.FC = () => {
  const { navigate, goBack } = useNavigation();
  const route = useRoute<RouteProp<ParamList, "FaceLiveness">>();
  const navigation = useNavigation();
  const { colors } = useContext(ThemeContext);
  const [document, setDocument] = useState<DocumentProps>({});
  const [errorDocument, setErrorDocument] = useState(false);
  const [success, setSuccess] = useState(false);
  const [authState] = useAuth();
  const { FaceModule } = NativeModules;
  const [localState, setLocalState] = useState({
    value: "",
    session_id: "",
    error: false,
    errorMessage: "",
    buttonEnabled: true,
  });

  const [isPrepare, setPrepare] = useState(false);
  const [isResult, setResult] = useState(false);
  const [status, setStatus] = useState("");

  const { getFacelivenessId, error, loading } = useGetFacelivenessId();
  const { uploadDocument, loading: loadingDocument } = useUploadDocument();
  const {
    fetchFacelivenessResult,
    dataFacelivenessResult,
    loadingFacelivenessResult,
    errorFacelivenessResult,
  } = useGetFacelivenessResult();

  const {
    dataFacelivenessCredentials,
    loadingFacelivenessCredentials,
    errorFacelivenessCredentials,
  } = useGetFacelivenessCredentials({
    id_token: authState.userJWT.idToken || "",
  });

  useEffect(() => {
    if (localState.session_id && success) {
      fetchFacelivenessResult(localState.session_id);
    } else if (localState.session_id && !success && document) {
      setPrepare(true);
    }
  }, [localState.session_id, success, document]);

  useEffect(() => {
    const onCompleteSubscription = DeviceEventEmitter.addListener(
      "FaceLivenessComplete",
      eventData => {
        // Navegue para a rota desejada
        console.log(eventData);
        console.log("FaceLivenessComplete");
        setErrorDocument(false);
        setSuccess(true);
        setStatus("sending");
        setPrepare(false);
        setResult(true);
      },
    );

    const onErrorSubscription = DeviceEventEmitter.addListener(
      "FaceLivenessError",
      eventData => {
        // Handle error (opcional: navegue para uma rota de erro)
        console.error(eventData);
        console.error("FaceLivenessError", "ERRO NO LIVENESS");
        setErrorDocument(true);
        setStatus("error");
        setPrepare(false);
        setSuccess(false);
        setResult(true);
      },
    );

    return () => {
      onCompleteSubscription.remove();
      onErrorSubscription.remove();
    };
  }, [navigation]);

  useEffect(() => {
    if (route.params?.clear) {
      clearState();
    }
  }, [route.params?.clear]);

  const scanDocument = async () => {
    const { scannedImages } = await DocumentScanner.scanDocument({
      maxNumDocuments: 1,
      responseType: ResponseType.ImageFilePath,
    });
    if (scannedImages && scannedImages?.length > 0) {
      BlobUtil.fs
        .readFile(scannedImages[0], "base64")
        .then(data => {
          setDocument({
            uri: "",
            mime_type: "image/jpeg",
            file_name: "liveness.jpg",
            size: formatBytes(0),
            data,
          });
        })
        .catch(err => {
          console.log(err, "erro");
          setErrorDocument(true);
        });
    }
  };

  const clearState = () => {
    setLocalState({
      ...localState,
      value: "",
      session_id: "",
      error: false,
      errorMessage: "",
      buttonEnabled: true,
    });
    setSuccess(false);
    setErrorDocument(false);
    setDocument({});
    setPrepare(false);
    setResult(false);
    setStatus("");
  };

  useEffect(() => {
    if (
      success &&
      dataFacelivenessResult &&
      dataFacelivenessResult?.GetFaceLivenessResult
    ) {
      const result = dataFacelivenessResult?.GetFaceLivenessResult;
      const status = result?.status;
      const isSuccess = status === "success";
      const statusReason = result?.status_reason;
      const statusMessage =
        statusReason === "no_liveness_detected"
          ? "Não foi detectado movimento"
          : statusReason === "no_faces_equals"
          ? "Não é a mesma pessoa"
          : "Erro desconhecido";

      setStatus(isSuccess ? "success" : "error");
      console.log(result);
      if (!isSuccess) {
        setTimeout(() => {
          goToFeedback();
        }, 2000);
      }
    }
    if (errorFacelivenessResult) {
      setStatus("error");
      setTimeout(() => {
        goToFeedback();
      }, 2000);
    }
  }, [dataFacelivenessResult, success, errorFacelivenessResult]);

  useEffect(() => {
    async function getPermission() {
      if (Platform.OS === "android") {
        const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
        const granted = await PermissionsAndroid.request(permission);

        if (granted !== "granted") {
          return;
        }

        const galleryPermission =
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        const grantedExternalStorage = await PermissionsAndroid.request(
          galleryPermission,
        );
        if (grantedExternalStorage !== "granted") {
          return;
        }
      }
    }
    getPermission();
  }, []);

  useEffect(() => {
    if (document?.data && !success) {
      handleGenerateId();
    }
  }, [document, success]);

  const handleSubmit = (): void => {
    const access_key_id =
      dataFacelivenessCredentials?.GetTemporaryCredentials?.access_key_id || "";
    const secret_key =
      dataFacelivenessCredentials?.GetTemporaryCredentials?.secret_key || "";
    const session_token =
      dataFacelivenessCredentials?.GetTemporaryCredentials?.session_token || "";
    const expiration =
      dataFacelivenessCredentials?.GetTemporaryCredentials?.expiration || "";
    NativeModules?.FaceModule?.showMyView(
      localState.value,
      access_key_id,
      secret_key,
      session_token,
      expiration,
    );
  };

  const handleGenerateId = (): void => {
    uploadDocument({
      variables: {
        photo_image: `data:image/jpeg;base64,${document?.data}`,
      },
    })
      .then(data1 => {
        getFacelivenessId({})
          .then((data: any) => {
            const idsession =
              data?.data?.GetFaceLivenessId?.liveness_session_id;
            setLocalState({
              ...localState,
              value: idsession || "",
              session_id: idsession || "",
            });
          })
          .catch(err => {
            console.log(err, "ERRO GERAR ID");
          });
      })
      .catch(err => {
        console.log(err, "ERRO ENVIAR ARQUIVO");
      });
  };

  const handleScan = async (): Promise<void> => {
    await scanDocument();
  };

  const goToFeedback = () => {
    navigate("FeedbacksError", {
      statusReason: FeedbacksErrorSchema.liveness_error,
    });
  };

  const handler: FaceLivenessComponentMenuProps = {
    handler: {
      actions: {
        goBack,
        navigate,
        close: (): void => navigate("Home"),
        goToFeedback: goToFeedback,
      },
      variables: {
        isError: error || errorDocument,
        helperButton: {
          onPress: isPrepare ? handleSubmit : handleScan,
          loading: loadingDocument || loadingFacelivenessCredentials || loading,
        },
        status: status,
      },
    },
  };
  return isPrepare ? (
    <FaceLivenessPrepareComponent {...handler} />
  ) : isResult ? (
    <FaceLivenessResultComponent {...handler} />
  ) : (
    <FaceLivenessComponent {...handler} />
  );
};
