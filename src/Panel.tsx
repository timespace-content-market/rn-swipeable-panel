import * as React from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  PanResponderInstance,
  ScrollViewProps,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Bar } from './Bar';
import { Close } from './Close';

let FULL_HEIGHT = Dimensions.get('window').height;
let FULL_WIDTH = Dimensions.get('window').width;
let PANEL_HEIGHT = FULL_HEIGHT - 100;

export enum STATUS {
  CLOSED = 0,
  SMALL = 1,
  LARGE = 2,
}

interface SwipeablePanelProps {
  isActive: boolean;
  canClose?: boolean;
  onClose?: () => void;
  showCloseButton?: boolean;
  fullWidth?: boolean;
  noBackgroundOpacity?: boolean;
  style?: object;
  closeRootStyle?: object;
  closeIconStyle?: object;
  closeOnTouchOutside?: boolean;
  onlyLarge?: boolean;
  onlySmall?: boolean;
  openLarge?: boolean;
  noBar?: boolean;
  barStyle?: object;
  allowTouchOutside?: boolean;
  scrollViewProps?: ScrollViewProps;
  smallPanelHeight?: number;
  largePanelHeight?: number;
  onChangeStatus?: (status: STATUS) => void;
}

interface SwipeablePanelState {
  status: STATUS;
  isActive: boolean;
  showComponent: boolean;
  canScroll: boolean;
  opacity: Animated.Value;
  pan: Animated.ValueXY;
  orientation: 'portrait' | 'landscape';
  deviceWidth: number;
  deviceHeight: number;
  panelHeight: number;
  currentHeight: number; 
}

class SwipeablePanel extends React.Component<
  SwipeablePanelProps,
  SwipeablePanelState
> {
  pan: Animated.ValueXY;
  isClosing: boolean;
  _panResponder: PanResponderInstance;
  animatedValueY: number;

  SMALL_PANEL_CONTENT_HEIGHT: number = PANEL_HEIGHT - (FULL_HEIGHT - 400) - 25;
  LARGE_PANEL_CONTENT_HEIGHT: number = PANEL_HEIGHT - 25;

  constructor(props: SwipeablePanelProps) {
    super(props);
    this.state = {
      status: STATUS.CLOSED,
      isActive: false,
      showComponent: false,
      canScroll: false,
      opacity: new Animated.Value(0),
      pan: new Animated.ValueXY({ x: 0, y: FULL_HEIGHT }),
      orientation: FULL_HEIGHT >= FULL_WIDTH ? 'portrait' : 'landscape',
      deviceWidth: FULL_WIDTH,
      deviceHeight: FULL_HEIGHT,
      panelHeight: PANEL_HEIGHT,
      currentHeight: this.props.smallPanelHeight
      ? FULL_HEIGHT - this.props.smallPanelHeight
      : this.state.orientation === 'portrait'
      ? FULL_HEIGHT - 400
      : FULL_HEIGHT / 3
    };

    this.pan = new Animated.ValueXY({ x: 0, y: FULL_HEIGHT });
    this.isClosing = false;
    this.animatedValueY = 0;

    this._panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        this.state.pan.setOffset({
          x: 0,
          y: this.animatedValueY,
        });
        this.state.pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        if (
          (this.state.status === STATUS.SMALL &&
            Math.abs((this.state.pan.y as any)._value) <=
              (this.state.pan.y as any)._offset) ||
          (this.state.status === STATUS.LARGE &&
            (this.state.pan.y as any)._value > -1)
        )
          this.state.pan.setValue({
            x: 0,
            y:
              this.state.status === STATUS.LARGE
                ? Math.max(0, gestureState.dy)
                : gestureState.dy,
          });
      },
      onPanResponderRelease: (evt, gestureState) => {
        const { onlyLarge, onlySmall } = this.props;
        this.state.pan.flattenOffset();

        if (gestureState.dy === 0) {
          this._animateTo(this.state.status);
        } else if (gestureState.dy < -100 || gestureState.vy < -0.5) {
          if (this.state.status === STATUS.SMALL)
            this._animateTo(onlySmall ? STATUS.SMALL : STATUS.LARGE);
          else this._animateTo(STATUS.LARGE);
        } else if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          if (this.state.status === STATUS.LARGE)
            this._animateTo(
              onlyLarge && this.props.canClose ? STATUS.CLOSED : STATUS.SMALL,
            );
          else this._animateTo(this.state.status);
        } else {
          this._animateTo(this.state.status);
        }
      },
    });
  }

  componentDidMount = () => {
    const { isActive, openLarge, onlyLarge, onlySmall } = this.props;

    this.animatedValueY = 0;
    this.state.pan.y.addListener(
      (value: any) => (this.animatedValueY = value.value),
    );

    this.setState({ isActive });

    if (isActive)
      this._animateTo(
        onlySmall
          ? STATUS.SMALL
          : openLarge
          ? STATUS.LARGE
          : onlyLarge
          ? STATUS.LARGE
          : STATUS.SMALL,
      );

    Dimensions.addEventListener('change', this._onOrientationChange);
  };

  _onOrientationChange = () => {
    const dimesions = Dimensions.get('screen');
    FULL_HEIGHT = dimesions.height;
    FULL_WIDTH = dimesions.width;
    PANEL_HEIGHT = FULL_HEIGHT - 100;

    this.setState({
      orientation:
        dimesions.height >= dimesions.width ? 'portrait' : 'landscape',
      deviceWidth: FULL_WIDTH,
      deviceHeight: FULL_HEIGHT,
      panelHeight: PANEL_HEIGHT,
    });
    if (this.props.onClose) this.props.onClose();
  };

  componentDidUpdate(
    prevProps: SwipeablePanelProps,
    prevState: SwipeablePanelState,
  ) {
    const { isActive, openLarge, onlyLarge, onlySmall } = this.props;
    if (onlyLarge && onlySmall)
      console.warn(
        'Ops. You are using both onlyLarge and onlySmall options. onlySmall will override the onlyLarge in this situation. Please select one of them or none.',
      );

    if (prevProps.isActive !== isActive) {
      this.setState({ isActive });

      if (isActive) {
        this._animateTo(
          onlySmall
            ? STATUS.SMALL
            : openLarge
            ? STATUS.LARGE
            : onlyLarge
            ? STATUS.LARGE
            : STATUS.SMALL,
        );
      } else {
        this._animateTo();
      }
    }

    if (prevState.orientation !== this.state.orientation)
      this._animateTo(this.state.status);
  }

  _animateTo = (newStatus = 0) => {
    let newY = 0;

    if (this.props.canClose && newStatus === STATUS.CLOSED) {
      newY = PANEL_HEIGHT;
    } else if (newStatus === STATUS.SMALL) {
      newY = this.props.smallPanelHeight
        ? FULL_HEIGHT - this.props.smallPanelHeight
        : this.state.orientation === 'portrait'
        ? FULL_HEIGHT - 400
        : FULL_HEIGHT / 3;
    } else if (newStatus === STATUS.LARGE) {
      newY = this.props.largePanelHeight
        ? FULL_HEIGHT - this.props.largePanelHeight
        : 0;
    }

    this.setState({
      showComponent: true,
      status: newStatus,
      currentHeight: PANEL_HEIGHT - newY
    });

    Animated.spring(this.state.pan, {
      toValue: { x: 0, y: newY },
      tension: 40,
      friction: 25,
      useNativeDriver: true,
      restDisplacementThreshold: 10,
      restSpeedThreshold: 10,
    }).start(() => {
      this.props.onChangeStatus?.(newStatus);

      if (newStatus === 0) {
        if (this.props.onClose) this.props.onClose();
        this.setState({
          showComponent: false,
        });
      } else {
        this.setState({ canScroll: newStatus === STATUS.LARGE });
      }
    });
  };

  render() {
    const {
      showComponent,
      deviceWidth,
      deviceHeight,
      panelHeight,
      currentHeight,
    } = this.state;
    const {
      noBackgroundOpacity,
      style,
      barStyle,
      closeRootStyle,
      closeIconStyle,
      onClose,
      allowTouchOutside,
      closeOnTouchOutside,
    } = this.props;

    return showComponent ? (
      <Animated.View
        style={[
          SwipeablePanelStyles.background,
          {
            backgroundColor: noBackgroundOpacity
              ? 'rgba(0,0,0,0)'
              : 'rgba(0,0,0,0.5)',
            height: allowTouchOutside ? currentHeight : deviceHeight,
            width: deviceWidth,
          },
        ]}
      >
        {closeOnTouchOutside && (
          <TouchableWithoutFeedback onPress={onClose}>
            <View
              style={[
                SwipeablePanelStyles.background,
                {
                  width: deviceWidth,
                  backgroundColor: 'rgba(0,0,0,0)',
                  height: allowTouchOutside ? currentHeight : deviceHeight,
                },
              ]}
            />
          </TouchableWithoutFeedback>
        )}
        <Animated.View
          style={[
            SwipeablePanelStyles.panel,
            {
              width: this.props.fullWidth ? deviceWidth : deviceWidth - 50,
              height: panelHeight,
            },
            { transform: this.state.pan.getTranslateTransform() },
            style,
          ]}
          {...this._panResponder.panHandlers}
        >
          {!this.props.noBar && <Bar barStyle={barStyle} />}
          {this.props.showCloseButton && (
            <Close
              rootStyle={closeRootStyle}
              iconStyle={closeIconStyle}
              onPress={this.props.onClose}
            />
          )}
          {this.props.children}
        </Animated.View>
      </Animated.View>
    ) : null;
  }
}

const SwipeablePanelStyles = StyleSheet.create({
  background: {
    position: 'absolute',
    zIndex: 1,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  panel: {
    position: 'absolute',
    height: PANEL_HEIGHT,
    width: FULL_WIDTH - 50,
    transform: [{ translateY: FULL_HEIGHT - 100 }],
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'white',
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
    zIndex: 2,
  },
  scrollViewContentContainerStyle: {
    width: '100%',
  },
});

export { SwipeablePanel };
